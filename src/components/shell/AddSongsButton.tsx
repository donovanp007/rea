"use client";
import { addFiles } from "@/lib/actions";

/** Accepts audio by type and by extension; iPhones grey out MP3s for a bare "audio/*". */
export const AUDIO_ACCEPT = "audio/*,.mp3,.m4a,.wav,.aac,.flac,.ogg,.aif,.aiff";

/**
 * A real file input stretched invisibly over the button, so tapping it opens the picker
 * directly. Phone browsers and in-app viewers don't always open a hidden input through a label.
 */
export function AddSongsButton({ primary = false }: { primary?: boolean }) {
  return (
    <span className={`btn file-btn${primary ? " primary" : ""}`}>
      Add songs
      <input
        type="file"
        className="file-overlay"
        accept={AUDIO_ACCEPT}
        multiple
        aria-label="Add songs"
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          e.target.value = "";
          if (files.length) void addFiles(files);
        }}
      />
    </span>
  );
}
