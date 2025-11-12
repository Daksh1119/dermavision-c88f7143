import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Upload as UploadIcon,
  Camera,
  ImageIcon,
  AlertCircle,
  CheckCircle2,
  X,
  RefreshCcw,
} from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { Alert, AlertDescription } from "@/components/ui/alert";

const Upload = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [consented, setConsented] = useState(false);

  // File inputs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fallbackCameraInputRef = useRef<HTMLInputElement>(null); // capture="environment" fallback

  // Camera modal / stream
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [capturedDataUrl, setCapturedDataUrl] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const readyTimeoutRef = useRef<number | null>(null);

  // Mirror compensation for front cameras so the preview/capture are NOT mirrored
  const [mirrorFix, setMirrorFix] = useState<boolean>(false);

  // Camera flipping support
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceIndex, setDeviceIndex] = useState<number>(0);
  const [useFront, setUseFront] = useState<boolean>(false);

  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
      } else {
        setLoading(false);
      }
    };
    checkAuth();
  }, [navigate]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
      if (readyTimeoutRef.current) {
        window.clearTimeout(readyTimeoutRef.current);
      }
    };
  }, []);

  // Start/attach camera when modal opens, stop when closes
  useEffect(() => {
    if (cameraOpen) {
      startCamera();
    } else {
      stopCamera();
      setCameraReady(false);
      setCapturedDataUrl(null);
      setCameraError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraOpen]);

  const validateImage = (file: File): boolean => {
    const validTypes = ["image/jpeg", "image/jpg", "image/png"];
    const maxSize = 10 * 1024 * 1024; // 10MB

    if (!validTypes.includes(file.type)) {
      toast.error("Please upload a JPG or PNG image");
      return false;
    }
    if (file.size > maxSize) {
      toast.error("Image must be less than 10MB");
      return false;
    }
    return true;
  };

  const checkImageResolution = (file: File): Promise<boolean> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const minResolution = 224;
        if (img.width < minResolution || img.height < minResolution) {
          toast.error(`Image resolution must be at least ${minResolution}×${minResolution}px`);
          resolve(false);
        } else {
          resolve(true);
        }
        URL.revokeObjectURL(img.src);
      };
      img.src = URL.createObjectURL(file);
    });
  };

  const processFile = async (file: File) => {
    if (!validateImage(file)) return;
    const ok = await checkImageResolution(file);
    if (!ok) return;
    setSelectedFile(file);
    setPreview(URL.createObjectURL(file));
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processFile(file);
  };

  const handleProceed = async () => {
    if (!selectedFile) {
      toast.error("Please select an image first");
      return;
    }
    if (!consented) {
      toast.error("Please consent to the privacy notice");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      sessionStorage.setItem(
        "uploadedFile",
        JSON.stringify({
          name: selectedFile.name,
          type: selectedFile.type,
          size: selectedFile.size,
          lastModified: selectedFile.lastModified,
          data: base64String,
        })
      );
      navigate("/form");
    };
    reader.readAsDataURL(selectedFile);
  };

  const clearSelection = () => {
    setSelectedFile(null);
    setPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (fallbackCameraInputRef.current) fallbackCameraInputRef.current.value = "";
  };

  // Open camera modal (stream starts via useEffect)
  const openCamera = () => {
    setCameraError(null);
    setCameraReady(false);
    setCapturedDataUrl(null);
    setCameraOpen(true);
    toast.info("If prompted, allow camera access.");
  };

  const startCamera = async () => {
    if (mediaStreamRef.current) {
      attachStreamToVideo(mediaStreamRef.current);
      return;
    }

    try {
      const primaryConstraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      };

      let stream = await navigator.mediaDevices.getUserMedia(primaryConstraints).catch(async () => {
        const fallbackConstraints: MediaStreamConstraints = {
          video: { facingMode: "user" },
          audio: false,
        };
        return navigator.mediaDevices.getUserMedia(fallbackConstraints);
      });

      mediaStreamRef.current = stream;

      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const vids = devices.filter((d) => d.kind === "videoinput");
        setVideoDevices(vids);
        const track = stream.getVideoTracks()[0];
        const settings = track.getSettings();
        const facing = (settings.facingMode || "").toString().toLowerCase();
        const usingFront = facing === "user" || /front/i.test(track.label);
        setMirrorFix(usingFront);

        const curId = settings.deviceId;
        if (curId) {
          const idx = vids.findIndex((v) => v.deviceId === curId);
          if (idx >= 0) setDeviceIndex(idx);
        } else if (vids.length) {
          const byLabel = vids.findIndex((v) => v.label && v.label === track.label);
          if (byLabel >= 0) setDeviceIndex(byLabel);
        }

        setUseFront(usingFront);
      } catch {}

      attachStreamToVideo(stream);
    } catch (err: any) {
      console.error("getUserMedia error:", err);
      setCameraError("Unable to access camera. Check browser permissions or use the gallery option.");
      fallbackCameraInputRef.current?.click();
    }
  };

  const attachStreamToVideo = (stream: MediaStream) => {
    const video = videoRef.current;
    if (!video) return;

    try {
      video.srcObject = stream;
    } catch {
      (video as any).srcObject = stream;
    }

    video.muted = true;
    video.playsInline = true;

    const markReady = () => {
      if (!cameraReady && video.videoWidth > 0 && video.videoHeight > 0) {
        setCameraReady(true);
      }
    };

    video.onloadedmetadata = null;
    video.oncanplay = null;

    video.onloadedmetadata = () => {
      video.play().catch(() => {});
      markReady();
    };
    video.oncanplay = () => {
      markReady();
    };

    if (readyTimeoutRef.current) window.clearTimeout(readyTimeoutRef.current);
    readyTimeoutRef.current = window.setTimeout(() => {
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        setCameraReady(true);
      }
    }, 1500);
  };

  const stopCamera = () => {
    try {
      const stream = mediaStreamRef.current;
      if (stream) stream.getTracks().forEach((t) => t.stop());
    } catch {}
    mediaStreamRef.current = null;

    const video = videoRef.current;
    if (video) {
      video.pause();
      (video as any).srcObject = null;
      video.onloadedmetadata = null;
      video.oncanplay = null;
    }
  };

  const closeCamera = () => {
    setCameraOpen(false);
  };

  const restartWithDevice = async (deviceId: string) => {
    try {
      setCameraReady(false);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: deviceId } },
        audio: false,
      });
      const track = stream.getVideoTracks()[0];
      const isFront = /front|user/i.test(track.label || "");
      setMirrorFix(isFront);
      stopCamera();
      mediaStreamRef.current = stream;
      attachStreamToVideo(stream);
    } catch (e) {
      console.warn("Failed to restart with deviceId, falling back to facingMode toggle:", e);
      await restartWithFacing(!useFront);
    }
  };

  const restartWithFacing = async (front: boolean) => {
    try {
      setCameraReady(false);
      const constraints: MediaStreamConstraints = {
        video: { facingMode: front ? "user" : "environment" },
        audio: false,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      const track = stream.getVideoTracks()[0];
      const settings = track.getSettings();
      setUseFront(front);
      const facing = (settings.facingMode || "").toString().toLowerCase();
      const isFront =
        front || facing === "user" || /front/i.test(track.label || "");
      setMirrorFix(isFront);

      stopCamera();
      mediaStreamRef.current = stream;
      attachStreamToVideo(stream);

      try {
        const vids = (await navigator.mediaDevices.enumerateDevices()).filter(
          (d) => d.kind === "videoinput"
        );
        setVideoDevices(vids);
        const curId = settings.deviceId;
        if (curId) {
          const idx = vids.findIndex((v) => v.deviceId === curId);
          if (idx >= 0) setDeviceIndex(idx);
        }
      } catch {}
    } catch (e) {
      console.warn("Failed to restart with facingMode:", e);
      fallbackCameraInputRef.current?.click();
    }
  };

  const flipCamera = async () => {
    if (videoDevices.length > 1) {
      const next = (deviceIndex + 1) % videoDevices.length;
      setDeviceIndex(next);
      await restartWithDevice(videoDevices[next].deviceId);
      return;
    }
    await restartWithFacing(!useFront);
  };

  const captureFrame = () => {
    const video = videoRef.current;
    if (!video || !cameraReady) {
      toast.error("Camera not ready yet");
      return;
    }
    let canvas = canvasRef.current;
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvasRef.current = canvas;
    }
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    canvas.width = vw;
    canvas.height = vh;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (mirrorFix) {
      ctx.save();
      ctx.translate(vw, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0, vw, vh);
      ctx.restore();
    } else {
      ctx.drawImage(video, 0, 0, vw, vh);
    }

    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    setCapturedDataUrl(dataUrl);
  };

  const retakePhoto = () => {
    setCapturedDataUrl(null);
  };

  const useCapturedPhoto = async () => {
    if (!capturedDataUrl) return;
    const file = dataURLToFile(capturedDataUrl, `camera_${Date.now()}.jpg`);
    await processFile(file);
    closeCamera();
  };

  const dataURLToFile = (dataUrl: string, filename: string): File => {
    const [meta, b64] = dataUrl.split(",");
    const mime = meta.match(/:(.*?);/)?.[1] ?? "image/jpeg";
    const binary = atob(b64);
    const len = binary.length;
    const u8 = new Uint8Array(len);
    for (let i = 0; i < len; i++) u8[i] = binary.charCodeAt(i);
    return new File([u8], filename, { type: mime });
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="medical-container py-8 max-w-4xl">
        <div className="mb-8 animate-fade-in">
          <h1 className="text-3xl font-bold mb-2">Upload Skin Image</h1>
          <p className="text-muted-foreground">
            Take or upload a clear photo of the affected area for analysis
          </p>
        </div>

        <Alert className="mb-6 border-warning bg-warning/5 animate-fade-in">
          <AlertCircle className="h-4 w-4 text-warning" />
          <AlertDescription className="text-sm">
            <strong>Privacy Notice:</strong> Your image is processed via a trusted third‑party AI service solely for dermatology image analysis. We do not sell your data. This is not a medical diagnosis — always consult a licensed dermatologist.
          </AlertDescription>
        </Alert>

        <div className="grid md:grid-cols-2 gap-6">
          <Card className="medical-card animate-fade-in">
            <CardHeader>
              <CardTitle>Image Upload</CardTitle>
              <CardDescription>Choose how you want to provide your image</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Hidden inputs */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png"
                onChange={handleFileSelect}
                className="hidden"
              />
              {/* Fallback camera input for browsers that don't support getUserMedia properly */}
              <input
                ref={fallbackCameraInputRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png"
                capture="environment"
                onChange={handleFileSelect}
                className="hidden"
              />

              <Button
                variant="outline"
                className="w-full h-24 border-2 border-dashed hover:border-primary transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="flex flex-col items-center gap-2">
                  <ImageIcon className="h-8 w-8 text-muted-foreground" />
                  <span>Choose from Gallery</span>
                </div>
              </Button>

              <Button
                variant="outline"
                className="w-full h-24 border-2 border-dashed hover:border-primary transition-colors bg-accent text-accent-foreground"
                onClick={openCamera}
              >
                <div className="flex flex-col items-center gap-2">
                  <Camera className="h-8 w-8" />
                  <span>Take Photo</span>
                </div>
              </Button>

              <div className="space-y-2 text-sm text-muted-foreground">
                <p className="font-medium">Requirements:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Formats: JPG or PNG</li>
                  <li>Max size: 10 MB</li>
                  <li>Min resolution: 224×224 pixels</li>
                  <li>Clear, well-lit image of affected area</li>
                  <li>No face photos allowed</li>
                </ul>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="consent"
                  checked={consented}
                  onChange={(e) => setConsented(e.target.checked)}
                  className="h-4 w-4 rounded border-input"
                />
                <label htmlFor="consent" className="text-sm leading-tight cursor-pointer">
                  I consent to having my image processed for AI analysis and understand this is not a medical diagnosis
                </label>
              </div>
            </CardContent>
          </Card>

          <Card className="medical-card animate-fade-in" style={{ animationDelay: "100ms" }}>
            <CardHeader>
              <CardTitle>Preview</CardTitle>
              <CardDescription>Review your selected image before proceeding</CardDescription>
            </CardHeader>
            <CardContent>
              {preview ? (
                <div className="space-y-4">
                  <div className="relative aspect-square bg-muted rounded-lg overflow-hidden">
                    <img src={preview} alt="Selected" className="w-full h-full object-cover" />
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 right-2"
                      onClick={clearSelection}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Filename:</span>
                      <span className="font-medium truncate ml-2">{selectedFile?.name}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Size:</span>
                      <span className="font-medium">
                        {((selectedFile?.size || 0) / 1024 / 1024).toFixed(2)} MB
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-success text-sm pt-2">
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Image validated successfully</span>
                    </div>
                  </div>
                  <Button className="w-full bg-accent hover:bg-accent/90" onClick={handleProceed} disabled={!consented}>
                    Proceed to Health Questionnaire →
                  </Button>
                </div>
              ) : (
                <div className="aspect-square bg-muted rounded-lg flex items-center justify-center">
                  <div className="text-center text-muted-foreground">
                    <UploadIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No image selected</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Camera Modal/Overlay */}
      {cameraOpen && (
        <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4">
          <div className="bg-background rounded-lg shadow-lg w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between p-3 border-b">
              <h3 className="font-semibold">Camera</h3>
              <Button variant="ghost" size="icon" onClick={closeCamera}>
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="p-4">
              {cameraError ? (
                <div className="text-center text-destructive">{cameraError}</div>
              ) : (
                <>
                  {!capturedDataUrl ? (
                    <div className="relative">
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        style={{ transform: mirrorFix ? "scaleX(-1)" : "none" }}
                        className="w-full h-auto rounded-md bg-black transition-transform"
                      />
                      {!cameraReady && (
                        <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
                          Initializing camera...
                        </div>
                      )}
                      <div className="mt-2 flex justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={flipCamera}
                          title="Switch between front and back cameras"
                          disabled={videoDevices.length < 2 && !("mediaDevices" in navigator)}
                        >
                          <RefreshCcw className="h-4 w-4 mr-1" />
                          Camera Flip
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="relative">
                      <canvas ref={canvasRef} className="hidden" />
                      <img src={capturedDataUrl} alt="Captured" className="w-full h-auto rounded-md" />
                    </div>
                  )}

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    {!capturedDataUrl ? (
                      <>
                        <Button className="col-span-2" onClick={captureFrame} disabled={!cameraReady}>
                          Capture
                        </Button>
                        <Button variant="outline" className="col-span-2" onClick={closeCamera}>
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button variant="outline" onClick={retakePhoto}>
                          Retake
                        </Button>
                        <Button onClick={useCapturedPhoto}>Use Photo</Button>
                        <Button variant="outline" className="col-span-2" onClick={closeCamera}>
                          Close
                        </Button>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
};

export default Upload;