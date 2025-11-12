from pathlib import Path
import json, gc, zipfile
import numpy as np
import tensorflow as tf

# Paths to your three folds
BASE = Path(r"C:\Users\daksh_769tz6y\Desktop\DermaVision\models\checkpoints")
FOLDS = ["effnetv2s_fold0", "effnetv2s_fold1", "effnetv2s_fold2"]
FILENAME = "best_val_acc.keras"  # change if your filename differs

def sniff_signature(path: Path) -> str:
    """
    Return: 'zip' (Keras 3 .keras), 'hdf5' (.h5/.hdf5), 'savedmodel_dir',
            'html', 'pdf', 'text', 'missing', or 'unknown'
    """
    try:
        if path.is_dir():
            return "savedmodel_dir" if (path / "saved_model.pb").exists() else "unknown"
        if not path.exists():
            return "missing"
        with open(path, "rb") as f:
            head = f.read(64)

        if head[:4] == b"PK\x03\x04":
            return "zip"      # Keras 3 .keras (ZIP-based)
        if head[:8] == b"\x89HDF\r\n\x1a\n":
            return "hdf5"     # HDF5 container
        if head.lstrip().startswith(b"<!DOCTYPE") or head.lstrip().startswith(b"<html"):
            return "html"
        if head.startswith(b"%PDF"):
            return "pdf"
        if head[:1] in (b"{", b"[") or all((32 <= b <= 126) or b in (9,10,13) for b in head):
            return "text"
        return "unknown"
    except Exception:
        return "unknown"

def try_open_container(path: Path, signature: str) -> dict:
    """Lightweight integrity checks for zip/hdf5 containers."""
    info = {"zip_ok": None, "hdf5_ok": None}
    if signature == "zip" and path.is_file():
        try:
            with zipfile.ZipFile(path, "r") as zf:
                bad = zf.testzip()  # None means OK
            info["zip_ok"] = (bad is None)
        except Exception:
            info["zip_ok"] = False
    elif signature == "hdf5" and path.is_file():
        try:
            import h5py  # uses the TF-compatible version you installed
            with h5py.File(path, "r") as f:
                _ = list(f.keys())[:3]
            info["hdf5_ok"] = True
        except Exception:
            info["hdf5_ok"] = False
    return info

def try_load_with_tfkeras(path: Path, signature: str) -> dict:
    """
    Attempt to load models that tf.keras can handle:
    - savedmodel_dir or hdf5 full models
    Keras-3 .keras (zip) is NOT supported by tf.keras 2.11.
    """
    res = {"loader": None, "ok": False, "units": None, "error": None}
    model = None
    try:
        if signature == "savedmodel_dir":
            model = tf.keras.models.load_model(str(path), compile=False)
            res["loader"] = "tf.saved_model"
        elif signature == "hdf5":
            model = tf.keras.models.load_model(str(path), compile=False)
            res["loader"] = "tf.keras_hdf5"
        else:
            res["error"] = f"Not loadable by tf.keras (signature={signature})"
            return res

        # Sanity check: one dummy predict
        arr = np.zeros((1, 224, 224, 3), dtype=np.float32)
        _ = model.predict(arr, verbose=0)
        try:
            units = int(model.outputs[0].shape[-1])
        except Exception:
            units = None
        res["ok"] = True
        res["units"] = units
        return res

    except Exception as e:
        res["ok"] = False
        res["error"] = str(e)
        return res
    finally:
        try:
            del model
        except Exception:
            pass
        gc.collect()
        tf.keras.backend.clear_session()

def check_one(path: Path) -> dict:
    entry = {
        "path": str(path),
        "exists": path.exists(),
        "is_dir": path.is_dir(),
        "size_mb": round(path.stat().st_size/1024/1024, 2) if path.exists() and path.is_file() else None,
        "signature": None,
    }
    sig = sniff_signature(path)
    entry["signature"] = sig
    entry.update(try_open_container(path, sig))

    # Only attempt tf.keras load where supported
    if sig in ("hdf5", "savedmodel_dir"):
        entry.update(try_load_with_tfkeras(path, sig))
    else:
        # For 'zip' (Keras 3 .keras), this environment cannot load it.
        entry.update({
            "loader": None,
            "ok": (entry.get("zip_ok") is True) if sig == "zip" else False,
            "units": None,
            "error": None if sig == "zip" else f"Not a loadable signature for tf.keras: {sig}"
        })
    return entry

def main():
    files = [BASE / fold / FILENAME for fold in FOLDS]
    results = [check_one(p) for p in files]
    print(json.dumps(results, indent=2))

if __name__ == "__main__":
    main()