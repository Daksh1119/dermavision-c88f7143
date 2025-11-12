from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import tensorflow as tf
import numpy as np
from PIL import Image
import json
import io
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
import logging
import traceback
from collections import Counter

# -----------------------------------------------------------------------------
# Logging
# -----------------------------------------------------------------------------
logging.basicConfig(level=logging.INFO, format="%(levelname)s:%(name)s:%(message)s")
logger = logging.getLogger("dermavision-ml")

# -----------------------------------------------------------------------------
# FastAPI app + CORS
# -----------------------------------------------------------------------------
app = FastAPI(title="DermaVision ML API", version="1.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://localhost:5175",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -----------------------------------------------------------------------------
# Globals
# -----------------------------------------------------------------------------
models: List[Any] = []                  # wrapped models with .predict(x)->np.ndarray
loaded_model_paths: List[str] = []
failed_model_paths: List[Dict[str, str]] = []

CLASS_NAMES: List[str] = []             # human-readable label names
LABEL_MAP: Dict = {}
THRESHOLDS: Dict = {}

# Effective number of classes used by the loaded ensemble
NUM_CLASSES: Optional[int] = None

# Paths (adjust to your environment)
MODEL_BASE_PATH = Path(r"C:\Users\daksh_769tz6y\Desktop\DermaVision\models\checkpoints")
METADATA_PATH   = Path(r"C:\Users\daksh_769tz6y\Desktop\DermaVision\metadata")

# -----------------------------------------------------------------------------
# Metadata
# -----------------------------------------------------------------------------
def load_metadata() -> None:
    """Load metadata files (class names, label maps, thresholds)."""
    global CLASS_NAMES, LABEL_MAP, THRESHOLDS
    try:
        class_info_path = METADATA_PATH / "class_info.json"
        if class_info_path.exists():
            with open(class_info_path, "r", encoding="utf-8") as f:
                class_info = json.load(f)
                CLASS_NAMES[:] = [item["name"] for item in class_info]
                logger.info(f"✓ Loaded {len(CLASS_NAMES)} classes from class_info.json")
        else:
            logger.warning(f"class_info.json not found at {class_info_path}; using placeholder names")
            CLASS_NAMES[:] = []

        label_map_path = METADATA_PATH / "disease_label_map.json"
        if label_map_path.exists():
            with open(label_map_path, "r", encoding="utf-8") as f:
                LABEL_MAP.clear()
                LABEL_MAP.update(json.load(f))
                logger.info(f"✓ Loaded disease label map with {len(LABEL_MAP)} entries")
        else:
            logger.warning(f"disease_label_map.json not found at {label_map_path}")

        thresholds_path = METADATA_PATH / "label_thresholds.json"
        if thresholds_path.exists():
            with open(thresholds_path, "r", encoding="utf-8") as f:
                THRESHOLDS.clear()
                THRESHOLDS.update(json.load(f))
                logger.info(f"✓ Loaded label thresholds with {len(THRESHOLDS)} entries")
        else:
            logger.warning(f"label_thresholds.json not found at {thresholds_path}")
    except Exception as e:
        logger.error(f"❌ Error loading metadata: {e}")
        logger.error(traceback.format_exc())

# -----------------------------------------------------------------------------
# Model discovery / loading
# -----------------------------------------------------------------------------
def discover_models() -> List[Path]:
    """Find SavedModel directories in the checkpoints folder."""
    if not MODEL_BASE_PATH.exists():
        logger.error(f"❌ MODEL_BASE_PATH does not exist: {MODEL_BASE_PATH}")
        return []

    candidates: List[Path] = []
    logger.info(f"Searching for models in: {MODEL_BASE_PATH}")

    for fold in sorted(MODEL_BASE_PATH.glob("effnetv2s_fold*")):
        savedmodel_pb = fold / "saved_model.pb"
        variables_dir = fold / "variables"

        if savedmodel_pb.is_file() and variables_dir.is_dir():
            candidates.append(fold)
            logger.info(f"  ✓ Found valid model at: {fold.name}")
        else:
            logger.warning(f"  ⚠ Incomplete model at {fold.name}: missing saved_model.pb or variables/")

    logger.info(f"Found {len(candidates)} valid model(s)")
    return candidates


class ModelWrapper:
    """
    Unifies SavedModel signature to a .predict(np.ndarray)->np.ndarray that returns
    a 1-D vector of length NUM_CLASSES for a single image (batch size 1).
    """
    def __init__(self, serving_fn, out_dim: int):
        self.serving_fn = serving_fn
        self.out_dim = out_dim

    def predict(self, x: np.ndarray, verbose: int = 0) -> np.ndarray:
        # Convert numpy array to tf tensor if needed
        if isinstance(x, np.ndarray):
            x = tf.constant(x, dtype=tf.float32)

        output = self.serving_fn(x)
        # Dict (signature outputs) -> first tensor
        if isinstance(output, dict):
            output_tensor = list(output.values())[0]
        else:
            output_tensor = output

        arr = output_tensor.numpy()
        # Expected shapes: (1, C) or (C,)
        arr = np.array(arr)
        if arr.ndim == 2 and arr.shape[0] == 1:
            arr = arr[0]
        elif arr.ndim == 1:
            pass
        else:
            raise ValueError(f"Model returned invalid output shape {arr.shape}")

        if arr.shape != (self.out_dim,):
            raise ValueError(f"Model output shape {arr.shape} != expected ({self.out_dim},)")
        return arr


def _probe_output_dim(serving_fn) -> int:
    """Run a dummy inference to determine output vector length."""
    dummy = tf.constant(np.zeros((1, 224, 224, 3), dtype=np.float32))
    out = serving_fn(dummy)
    if isinstance(out, dict):
        out = list(out.values())[0]
    arr = np.array(out.numpy())
    if arr.ndim == 2 and arr.shape[0] == 1:
        c = int(arr.shape[1])
    elif arr.ndim == 1:
        c = int(arr.shape[0])
    else:
        raise ValueError(f"Invalid output shape from probe: {arr.shape}")
    return c


def _align_class_names(effective_classes: int) -> None:
    """Ensure CLASS_NAMES has exactly effective_classes entries."""
    global CLASS_NAMES
    if len(CLASS_NAMES) == effective_classes:
        return
    if len(CLASS_NAMES) == 0:
        CLASS_NAMES = [f"Class_{i}" for i in range(effective_classes)]
        logger.warning(f"No class names metadata found. Using placeholders 0..{effective_classes-1}.")
    elif len(CLASS_NAMES) > effective_classes:
        logger.warning(
            f"class_info length ({len(CLASS_NAMES)}) > model output ({effective_classes}); truncating names."
        )
        CLASS_NAMES = CLASS_NAMES[:effective_classes]
    else:
        logger.warning(
            f"class_info length ({len(CLASS_NAMES)}) < model output ({effective_classes}); padding with placeholders."
        )
        missing = [f"Class_{i}" for i in range(len(CLASS_NAMES), effective_classes)]
        CLASS_NAMES = CLASS_NAMES + missing


def load_models() -> None:
    """
    Load all SavedModels found, validate output shapes, and keep only models
    that agree on a single consistent output dimension (NUM_CLASSES).
    """
    global models, loaded_model_paths, failed_model_paths, NUM_CLASSES

    models.clear()
    loaded_model_paths.clear()
    failed_model_paths.clear()
    NUM_CLASSES = None

    candidates = discover_models()
    if not candidates:
        logger.error("❌ No model candidates found!")
        logger.error(f"   Please check that models exist in: {MODEL_BASE_PATH}")
        return

    logger.info("=" * 60)
    logger.info("Loading models...")
    logger.info("=" * 60)

    provisional: List[Tuple[ModelWrapper, str, int]] = []  # (wrapper, path, out_dim)

    for i, path in enumerate(candidates):
        model_name = path.name
        try:
            logger.info(f"[{i+1}/{len(candidates)}] Loading {model_name}...")
            loaded = tf.saved_model.load(str(path))
            logger.info(f"  ✓ Model loaded from disk as TensorFlow SavedModel")

            serving_fn = None
            if hasattr(loaded, "signatures"):
                if "serving_default" in loaded.signatures:
                    serving_fn = loaded.signatures["serving_default"]
                    logger.info(f"  ✓ Found 'serving_default' signature")
                else:
                    sig_keys = list(loaded.signatures.keys())
                    if sig_keys:
                        serving_fn = loaded.signatures[sig_keys[0]]
                        logger.info(f"  ✓ Using signature: {sig_keys[0]}")

            if serving_fn is None:
                raise RuntimeError("No serving function found in SavedModel")

            out_dim = _probe_output_dim(serving_fn)
            logger.info(f"  ✓ Probe successful: output dimension = {out_dim}")

            wrapped = ModelWrapper(serving_fn, out_dim)
            provisional.append((wrapped, str(path), out_dim))
            logger.info(f"  ✅ {model_name} loaded and validated!\n")

        except Exception as e:
            err = f"{type(e).__name__}: {e}"
            failed_model_paths.append({"path": str(path), "error": err})
            logger.error(f"  ❌ Failed to load {model_name}")
            logger.error(f"     Error: {err}\n")
            logger.error(traceback.format_exc())

    if not provisional:
        logger.error("❌❌❌ CRITICAL: All models failed to load. API will not work! ❌❌❌")
        return

    # Determine effective NUM_CLASSES.
    # Prefer metadata length if present; otherwise choose the most common out_dim among models.
    metadata_classes = len(CLASS_NAMES)
    dims = [d for (_, _, d) in provisional]
    chosen_dim: Optional[int] = None

    if metadata_classes > 0:
        # Choose metadata length; drop any model not matching it.
        chosen_dim = metadata_classes
        kept = [(w, p, d) for (w, p, d) in provisional if d == chosen_dim]
        dropped = [(w, p, d) for (w, p, d) in provisional if d != chosen_dim]
        if dropped:
            for _, p, d in dropped:
                failed_model_paths.append({"path": p, "error": f"Output dim {d} != metadata {chosen_dim}"})
                logger.error(f"❌ Dropping model {p}: output dim {d} != metadata {chosen_dim}")
        provisional = kept
        if not provisional:
            # If everything dropped due to mismatch, fall back to majority dimension
            counts = Counter(dims)
            chosen_dim = counts.most_common(1)[0][0]
            logger.warning(
                f"All models mismatched metadata length {metadata_classes}. "
                f"Falling back to majority output dim {chosen_dim}."
            )
            provisional = [(w, p, d) for (w, p, d) in provisional if d == chosen_dim] or [
                (w, p, d) for (w, p, d) in provisional  # safeguard
            ]
    else:
        # No metadata constraint: choose majority output dimension.
        counts = Counter(dims)
        chosen_dim = counts.most_common(1)[0][0]
        logger.info(f"Chosen output dimension (majority vote) = {chosen_dim}")
        provisional = [(w, p, d) for (w, p, d) in provisional if d == chosen_dim]
        for _, p, d in [(w, p, d) for (w, p, d) in provisional if d != chosen_dim]:
            failed_model_paths.append({"path": p, "error": f"Output dim {d} != chosen {chosen_dim}"})
            logger.error(f"❌ Dropping model {p}: output dim {d} != chosen {chosen_dim}")

    # Finalize NUM_CLASSES and align CLASS_NAMES length
    NUM_CLASSES = chosen_dim
    _align_class_names(NUM_CLASSES)

    # Commit kept models
    models[:] = [w for (w, _, _) in provisional]
    loaded_model_paths[:] = [p for (_, p, _) in provisional]

    logger.info("=" * 60)
    logger.info("Model Loading Summary:")
    logger.info(f"  ✅ Successfully loaded: {len(models)} model(s) with output dim {NUM_CLASSES}")
    logger.info(f"  ❌ Failed to load: {len(failed_model_paths)} model(s)")
    logger.info("=" * 60)

    if len(models) == 0:
        logger.error("❌❌❌ CRITICAL: NO MODELS LOADED! API WILL NOT WORK! ❌❌❌")
    else:
        logger.info(f"✓ API ready with {len(models)} model(s) (output classes={NUM_CLASSES})")

# -----------------------------------------------------------------------------
# Preprocessing
# -----------------------------------------------------------------------------
def preprocess_image(image: Image.Image, target_size=(224, 224)) -> np.ndarray:
    """Preprocess image for model input."""
    try:
        if image.mode != "RGB":
            logger.info(f"  Converting image from {image.mode} to RGB")
            image = image.convert("RGB")

        original_size = image.size
        image = image.resize(target_size, Image.LANCZOS)
        if original_size != target_size:
            logger.info(f"  Resized from {original_size} to {target_size}")

        img_array = np.array(image, dtype=np.float32) / 255.0
        img_array = np.expand_dims(img_array, axis=0)  # (1,H,W,3)

        logger.info(f"  Preprocessed array shape: {img_array.shape}, dtype: {img_array.dtype}")
        return img_array

    except Exception as e:
        logger.error(f"Error preprocessing image: {e}")
        raise

# -----------------------------------------------------------------------------
# TTA helpers
# -----------------------------------------------------------------------------
def horizontal_flip(x: np.ndarray) -> np.ndarray:
    # x shape: (1,H,W,3)
    return np.flip(x, axis=2)

# -----------------------------------------------------------------------------
# Ensemble prediction (robust, shape-safe)
# -----------------------------------------------------------------------------
def _ensure_vector(pred: np.ndarray, expect_len: int) -> np.ndarray:
    """Coerce model output to a 1-D vector of length expect_len."""
    arr = np.array(pred)
    if arr.ndim == 2 and arr.shape[0] == 1:
        arr = arr[0]
    elif arr.ndim != 1:
        raise ValueError(f"Invalid prediction shape {arr.shape}; expected (C,) or (1,C)")
    if arr.shape != (expect_len,):
        raise ValueError(f"Prediction shape {arr.shape} != expected ({expect_len},)")
    return arr


def ensemble_predict(img_array: np.ndarray, use_tta: bool = True) -> np.ndarray:
    """Perform ensemble prediction with optional Test-Time Augmentation."""
    if not models:
        logger.error("No models available for prediction")
        raise HTTPException(status_code=503, detail="No models loaded. Please check server logs.")

    if NUM_CLASSES is None:
        raise HTTPException(status_code=500, detail="NUM_CLASSES not determined; models not initialized correctly.")

    logger.info(
        f"Running ensemble prediction with {len(models)} model(s), TTA={'enabled' if use_tta else 'disabled'}"
    )

    per_model_vectors: List[np.ndarray] = []

    for idx, model in enumerate(models):
        try:
            if use_tta:
                # Original
                p1 = model.predict(img_array, verbose=0)
                v1 = _ensure_vector(p1, NUM_CLASSES)

                # Flipped
                img_flipped = horizontal_flip(img_array)
                p2 = model.predict(img_flipped, verbose=0)
                v2 = _ensure_vector(p2, NUM_CLASSES)

                # Average TTA variants -> (C,)
                v = (v1 + v2) / 2.0
                logger.info(f"  Model {idx}: TTA prediction complete (shape={v.shape})")
            else:
                p = model.predict(img_array, verbose=0)
                v = _ensure_vector(p, NUM_CLASSES)
                logger.info(f"  Model {idx}: Standard prediction complete (shape={v.shape})")

            per_model_vectors.append(v)

        except Exception as e:
            # Skip only the failing model; continue with others
            logger.error(f"Model {idx} prediction failed: {type(e).__name__}: {e}")
            logger.error(traceback.format_exc())

    if not per_model_vectors:
        raise HTTPException(status_code=500, detail="All models failed to produce predictions.")

    # Stack safely -> (num_valid_models, C)
    stacked = np.vstack(per_model_vectors)
    avg_pred = np.mean(stacked, axis=0)  # (C,)
    logger.info(f"  Ensemble complete - stacked shape: {stacked.shape}, final vector shape: {avg_pred.shape}")

    # Softmax for probabilities (stable)
    avg_pred = avg_pred - np.max(avg_pred)
    exp_scores = np.exp(avg_pred)
    probs = exp_scores / (np.sum(exp_scores) + 1e-12)

    return probs  # (C,)

# -----------------------------------------------------------------------------
# Startup
# -----------------------------------------------------------------------------
@app.on_event("startup")
async def startup_event():
    """Initialize API on startup."""
    logger.info("\n" + "=" * 70)
    logger.info("🚀 Starting DermaVision ML API")
    logger.info("=" * 70)
    logger.info(f"MODEL_BASE_PATH = {MODEL_BASE_PATH}")
    logger.info(f"METADATA_PATH   = {METADATA_PATH}")
    logger.info("=" * 70 + "\n")

    load_metadata()
    load_models()

    logger.info("\n" + "=" * 70)
    if len(models) > 0:
        logger.info(f"✅ DermaVision ML API is READY! (models={len(models)}, classes={NUM_CLASSES})")
    else:
        logger.error("❌ DermaVision ML API started but NO MODELS LOADED!")
    logger.info("=" * 70 + "\n")

# -----------------------------------------------------------------------------
# Endpoints
# -----------------------------------------------------------------------------
@app.get("/")
async def root():
    """Root endpoint - API status"""
    return {
        "status": "online" if len(models) > 0 else "degraded",
        "service": "DermaVision ML API",
        "version": "1.1.0",
        "models_loaded": len(models),
        "num_classes": int(NUM_CLASSES or 0),
        "message": "API is ready" if len(models) > 0 else "No models loaded",
    }


@app.get("/health")
async def health_check():
    """Health check endpoint with detailed status"""
    return {
        "status": "healthy" if len(models) > 0 else "unhealthy",
        "models_loaded": len(models),
        "loaded_model_paths": loaded_model_paths,
        "failed_model_paths": failed_model_paths,
        "classes": int(NUM_CLASSES or 0),
        "class_names_count": len(CLASS_NAMES),
        "model_base_path": str(MODEL_BASE_PATH),
        "metadata_path": str(METADATA_PATH),
        "models_available": len(models) > 0,
    }


@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    """
    Main prediction endpoint.
    Accepts an image file (multipart/form-data) and returns predictions.
    """
    try:
        # Validate models are loaded
        if len(models) == 0 or NUM_CLASSES is None:
            raise HTTPException(status_code=503, detail="No models loaded. Service is unavailable.")

        # Validate file type
        if not file.content_type or not file.content_type.startswith("image/"):
            raise HTTPException(status_code=400, detail="File must be an image")

        logger.info("=" * 60)
        logger.info("📸 Processing prediction request")
        logger.info(f"  Filename: {file.filename}")
        logger.info(f"  Content-Type: {file.content_type}")

        contents = await file.read()
        logger.info(f"  File size: {len(contents) / 1024:.2f} KB")

        image = Image.open(io.BytesIO(contents))
        logger.info(f"  Image size: {image.size}, mode: {image.mode}")

        # Preprocess
        img_array = preprocess_image(image)

        # Predict (robust ensemble)
        probabilities = ensemble_predict(img_array, use_tta=True)  # (C,)

        # Top K predictions
        c_len = probabilities.shape[0]
        top_k = min(5, c_len)
        top_indices = np.argsort(probabilities)[-top_k:][::-1]

        results = []
        for rank, idx in enumerate(top_indices, 1):
            label_name = CLASS_NAMES[idx] if idx < len(CLASS_NAMES) else f"Class_{idx}"
            confidence = float(probabilities[idx])
            results.append(
                {
                    "rank": rank,
                    "label_id": int(idx),
                    "label_name": label_name,
                    "confidence": confidence,
                }
            )

        # Malignant probability heuristic (adjust indices per your dataset)
        malignant_classes = [0, 1, 2, 3, 4]
        malignant_prob = float(
            sum(probabilities[i] for i in malignant_classes if 0 <= i < c_len)
        )
        malignant_flag = bool(malignant_prob > 0.5)

        response = {
            "success": True,
            "model_version": "effnetv2s-fold-ensemble",
            "folds_used": [i for i in range(len(models))],
            "tta_enabled": True,
            "top_predictions": results,
            "top1_label": results[0]["label_name"] if results else None,
            "top1_confidence": results[0]["confidence"] if results else None,
            "malignant_probability": malignant_prob,
            "malignant_flag": malignant_flag,
            # Optional full distribution (can be large; include if you want UI to use it)
            # "probabilities": [float(p) for p in probabilities],
        }

        logger.info("✅ Prediction successful!")
        if results:
            logger.info(f"  Top prediction: {response['top1_label']} ({response['top1_confidence']:.2%})")
        logger.info(f"  Malignant probability: {malignant_prob:.2%}")
        logger.info("=" * 60 + "\n")

        return response

    except HTTPException:
        logger.info("=" * 60 + "\n")
        raise
    except Exception as e:
        logger.error(f"❌ Prediction error: {type(e).__name__}: {e}")
        logger.error(traceback.format_exc())
        logger.info("=" * 60 + "\n")
        raise HTTPException(status_code=500, detail=f"Prediction failed: {e}")


@app.get("/classes")
async def get_classes():
    """Get list of all classes the model can predict."""
    return {
        "classes": CLASS_NAMES,
        "total": len(CLASS_NAMES),
        "num_classes": int(NUM_CLASSES or 0),
    }

# -----------------------------------------------------------------------------
# Entrypoint
# -----------------------------------------------------------------------------
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080, log_level="info")