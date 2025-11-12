from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import tensorflow as tf
import numpy as np
from PIL import Image
import io
from typing import List
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="DermaVision AI API")

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174", "http://localhost:5175"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Disease class names (43 classes from your model)
CLASS_NAMES = [
    "Actinic Keratosis",
    "Basal Cell Carcinoma",
    "Benign Keratosis",
    "Dermatofibroma",
    "Melanoma",
    "Melanocytic Nevus",
    "Squamous Cell Carcinoma",
    "Vascular Lesion",
    "Acne",
    "Eczema",
    "Psoriasis",
    "Rosacea",
    "Vitiligo",
    "Warts",
    "Seborrheic Keratosis",
    "Hemangioma",
    "Pyogenic Granuloma",
    "Molluscum Contagiosum",
    "Tinea",
    "Candidiasis",
    "Folliculitis",
    "Impetigo",
    "Cellulitis",
    "Herpes Simplex",
    "Herpes Zoster",
    "Scabies",
    "Lyme Disease",
    "Lupus Erythematosus",
    "Dermatomyositis",
    "Scleroderma",
    "Pemphigus",
    "Bullous Pemphigoid",
    "Drug Eruption",
    "Urticaria",
    "Angioedema",
    "Contact Dermatitis",
    "Atopic Dermatitis",
    "Lichen Planus",
    "Pityriasis Rosea",
    "Seborrheic Dermatitis",
    "Alopecia Areata",
    "Nail Fungus",
    "Keloid"
]

# Malignant disease indices (adjust based on your training)
MALIGNANT_CLASSES = {0, 1, 4, 6}  # Actinic Keratosis, BCC, Melanoma, SCC

# Global models list
models: List[tf.keras.Model] = []

def load_models():
    """Load all 3 fold models at startup"""
    global models
    model_paths = [
        "./ml-service/models/checkpoints/effnetv2s_fold0",
        "./ml-service/models/checkpoints/effnetv2s_fold1",
        "./ml-service/models/checkpoints/effnetv2s_fold2"
    ]
    
    for path in model_paths:
        try:
            model = tf.keras.models.load_model(path)
            models.append(model)
            logger.info(f"✅ Loaded model: {path}")
        except Exception as e:
            logger.error(f"❌ Failed to load model {path}: {str(e)}")
            raise
    
    logger.info(f"🎯 Successfully loaded {len(models)} models")

@app.on_event("startup")
async def startup_event():
    """Load models when API starts"""
    load_models()

def preprocess_image(image_bytes: bytes, target_size=(224, 224)) -> np.ndarray:
    """Preprocess image for model input"""
    try:
        # Open image
        image = Image.open(io.BytesIO(image_bytes))
        
        # Convert to RGB if needed
        if image.mode != 'RGB':
            image = image.convert('RGB')
        
        # Resize
        image = image.resize(target_size, Image.Resampling.LANCZOS)
        
        # Convert to array and normalize
        img_array = np.array(image, dtype=np.float32)
        
        # Normalize to [0, 1]
        img_array = img_array / 255.0
        
        # Add batch dimension
        img_array = np.expand_dims(img_array, axis=0)
        
        return img_array
    except Exception as e:
        logger.error(f"Image preprocessing failed: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Image preprocessing failed: {str(e)}")

def ensemble_predict(img_array: np.ndarray, use_tta: bool = True) -> tuple:
    """
    Perform ensemble prediction using all 3 models with optional TTA
    Returns: (class_predictions, malignant_probability)
    """
    try:
        predictions = []
        
        for model in models:
            # Original image prediction
            pred1 = model.predict(img_array, verbose=0)
            
            # Test-Time Augmentation: horizontal flip
            if use_tta:
                img_flipped = np.flip(img_array, axis=2)
                pred2 = model.predict(img_flipped, verbose=0)
                # Average original and flipped predictions
                preds = (pred1 + pred2) / 2
            else:
                preds = pred1
            
            predictions.append(preds)
        
        # Ensemble: average predictions from all models
        avg_pred = np.mean(predictions, axis=0)[0]
        
        # Calculate malignant risk
        malignant_prob = sum(avg_pred[i] for i in MALIGNANT_CLASSES)
        
        return avg_pred, float(malignant_prob)
    
    except Exception as e:
        logger.error(f"Prediction failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")

@app.post("/api/predict")
async def predict(file: UploadFile = File(...)):
    """
    Main prediction endpoint
    Accepts an image file and returns predictions
    """
    # Validate file type
    if not file.content_type.startswith('image/'):
        raise HTTPException(status_code=400, detail="File must be an image")
    
    try:
        # Read image bytes
        image_bytes = await file.read()
        
        # Preprocess
        img_array = preprocess_image(image_bytes)
        
        # Predict
        class_probs, malignant_prob = ensemble_predict(img_array, use_tta=True)
        
        # Get top 5 predictions
        top_5_indices = np.argsort(class_probs)[-5:][::-1]
        top_5_predictions = [
            {
                "label": CLASS_NAMES[idx],
                "confidence": float(class_probs[idx])
            }
            for idx in top_5_indices
        ]
        
        # Calculate risk assessment
        threshold = 0.30
        risk_label = "Low risk" if malignant_prob < threshold else "High risk"
        
        response = {
            "predictions": top_5_predictions,
            "malignant_risk": {
                "probability": malignant_prob,
                "threshold": threshold,
                "risk_label": risk_label
            },
            "model_info": {
                "architecture": "EfficientNetV2S",
                "version": "v2.5-folds",
                "num_models": len(models)
            }
        }
        
        logger.info(f"✅ Prediction successful: {top_5_predictions[0]['label']} ({top_5_predictions[0]['confidence']:.2%})")
        
        return JSONResponse(content=response)
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "models_loaded": len(models),
        "model_version": "v2.5-folds"
    }

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "DermaVision AI API",
        "version": "1.0.0",
        "endpoints": [
            "/api/predict",
            "/api/health",
            "/docs"
        ]
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)