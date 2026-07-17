import { AppNavbar } from "@/presentation/features/home/components/app-navbar";
import { VideoUploader } from "@/presentation/features/upload/components/video-uploader";
import {
  FFMPEG_COMPRESS_CONCURRENCY,
  MAX_UI_VIDEO_BYTES,
  MAX_UI_VIDEO_FILES,
} from "@/domain/upload/video-upload-policy";

export const metadata = {
  title: "Upload de vídeo — Upload SAS",
  description: "Upload direto de vídeo para o Azure Blob Storage (SAS).",
};

export default function UploadVideosPage() {
  return (
    <>
      <AppNavbar />
      <main className="flex flex-1 flex-col bg-neutral-50 px-4 py-10 sm:px-6">
        <div className="mx-auto w-full max-w-2xl">
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">Upload de vídeo</h1>
          <p className="mt-2 text-sm text-neutral-600">
            Até {MAX_UI_VIDEO_FILES} vídeos (máx. {MAX_UI_VIDEO_BYTES / (1024 * 1024)} MB cada).
            Comprime localmente com FFmpeg (WASM, máx. 720p, até {FFMPEG_COMPRESS_CONCURRENCY} em
            paralelo), vê a taxa de compressão e descarrega para validar; depois envia para o Azure
            com SAS — o binário vai direto para o Blob.
          </p>
          <div className="mt-8">
            <VideoUploader />
          </div>
        </div>
      </main>
    </>
  );
}
