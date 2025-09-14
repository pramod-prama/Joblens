import React, { useState } from "react";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

const ResumeFolderInput = () => {
  const [files, setFiles] = useState<FileList | null>(null);
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (selectedFiles && selectedFiles.length > 0) {
      setFiles(selectedFiles);
      toast({
        title: "Files selected",
        description: `${selectedFiles.length} CV(s) ready for upload`,
      });
    }
  };

  // Handle file upload
  const handleSubmit = async () => {
    if (!files || files.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one CV file",
        variant: "destructive",
      });
      return;
    }

    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append("cvs", files[i]); // "cvs" must match multer array name
    }

    try {
      setLoading(true);
      const token = localStorage.getItem("token"); // Get your JWT token

      const response = await axios.post(
        "http://localhost:5000/api/v1/cv/upload-cv",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
            Authorization: `Bearer ${token}`, // Attach token
          },
          onUploadProgress: (progressEvent) => {
            if (progressEvent.total) {
              const percent = Math.round(
                (progressEvent.loaded * 100) / progressEvent.total
              );
              setProgress(percent);
            }
          },
        }
      );

      toast({
        title: "Upload Success",
        description: `${response.data.uploaded} CV(s) uploaded successfully`,
      });
      setFiles(null);
      setProgress(0);
    } catch (error: any) {
      toast({
        title: "Upload Failed",
        description: error.response?.data?.message || "Something went wrong",
        variant: "destructive",
      });
      setProgress(0);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 border rounded-lg space-y-4">
      <div className="space-y-2">
        <Label htmlFor="cv-upload">Select CV Files</Label>
        <Input
          id="cv-upload"
          type="file"
          multiple
          accept=".pdf,.docx"
          onChange={handleFileSelect}
        />
        {files && <p>{files.length} file(s) selected</p>}
      </div>

      {progress > 0 && progress < 100 && (
        <div className="w-full bg-gray-200 rounded h-2">
          <div
            className="bg-purple-600 h-2 rounded"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
      )}

      <div className="flex space-x-2">
        <Button onClick={handleSubmit} disabled={loading}>
          {loading ? "Uploading..." : "Upload CVs"}
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            setFiles(null);
            setProgress(0);
          }}
        >
          Reset
        </Button>
      </div>
    </div>
  );
};

export default ResumeFolderInput;
