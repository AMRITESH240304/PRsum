import { Upload } from "lucide-react";
import { useCallback, useState } from "react";

export function FileDropZone({ onFile }: { onFile: (content: string, name: string) => void }) {
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) readFile(file);
    },
    []
  );

  const readFile = (file: File) => {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      onFile(e.target?.result as string, file.name);
    };
    reader.readAsText(file);
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 transition-colors ${
        isDragging
          ? "border-primary bg-primary/5"
          : "border-border hover:border-muted-foreground"
      }`}
    >
      <Upload className="mb-3 h-10 w-10 text-muted-foreground" />
      <p className="mb-1 text-sm font-medium text-foreground">
        {fileName || "Drop .diff, .patch, or text file here"}
      </p>
      <p className="text-xs text-muted-foreground">or click to browse</p>
      <input
        type="file"
        accept=".diff,.patch,.txt"
        className="absolute inset-0 cursor-pointer opacity-0"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) readFile(file);
        }}
        style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer" }}
      />
    </div>
  );
}
