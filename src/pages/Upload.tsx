import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload as UploadIcon, Camera, ImageIcon, AlertCircle, CheckCircle2, X } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { Alert, AlertDescription } from "@/components/ui/alert";

const Upload = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [consented, setConsented] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
      } else {
        setLoading(false);
      }
    };
    checkAuth();
  }, [navigate]);

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

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!validateImage(file)) return;
    
    const validResolution = await checkImageResolution(file);
    if (!validResolution) return;

    setSelectedFile(file);
    setPreview(URL.createObjectURL(file));
  };

  const handleProceed = () => {
    if (!selectedFile) {
      toast.error("Please select an image first");
      return;
    }

    if (!consented) {
      toast.error("Please consent to the privacy notice");
      return;
    }

    // Store file in session for next page
    sessionStorage.setItem("uploadedFile", JSON.stringify({
      name: selectedFile.name,
      type: selectedFile.type,
      size: selectedFile.size,
      lastModified: selectedFile.lastModified
    }));
    
    navigate("/form");
  };

  const clearSelection = () => {
    setSelectedFile(null);
    setPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
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
            <strong>Privacy Notice:</strong> Your image will be processed by our AI model for diagnostic purposes. 
            We do not share your data with third parties. Images are encrypted and stored securely. 
            This is not a medical diagnosis - always consult a licensed dermatologist.
          </AlertDescription>
        </Alert>

        <div className="grid md:grid-cols-2 gap-6">
          <Card className="medical-card animate-fade-in">
            <CardHeader>
              <CardTitle>Image Upload</CardTitle>
              <CardDescription>
                Choose how you want to provide your image
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png"
                onChange={handleFileSelect}
                className="hidden"
              />
              <input
                ref={cameraInputRef}
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
                className="w-full h-24 border-2 border-dashed hover:border-primary transition-colors"
                onClick={() => cameraInputRef.current?.click()}
              >
                <div className="flex flex-col items-center gap-2">
                  <Camera className="h-8 w-8 text-muted-foreground" />
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
              <CardDescription>
                Review your selected image before proceeding
              </CardDescription>
            </CardHeader>
            <CardContent>
              {preview ? (
                <div className="space-y-4">
                  <div className="relative aspect-square bg-muted rounded-lg overflow-hidden">
                    <img
                      src={preview}
                      alt="Selected"
                      className="w-full h-full object-cover"
                    />
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
                  <Button
                    className="w-full bg-accent hover:bg-accent/90"
                    onClick={handleProceed}
                    disabled={!consented}
                  >
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
    </AppLayout>
  );
};

export default Upload;
