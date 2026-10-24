import { useEffect, useRef } from "preact/hooks";
import jsQR from "jsqr";
import { extractRoomId } from "../model/qrLink";

export function QrScanner(props: { onResult: (roomId: string) => void; onCancel: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    let done = false;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    const tick = () => {
      const video = videoRef.current;
      if (done || !video || !ctx || video.readyState !== video.HAVE_ENOUGH_DATA) { raf = requestAnimationFrame(tick); return; }
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(frame.data, frame.width, frame.height);
      const roomId = code ? extractRoomId(code.data) : null;
      if (roomId) { done = true; props.onResult(roomId); return; }
      raf = requestAnimationFrame(tick);
    };

    navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
      .then((s) => {
        stream = s;
        if (videoRef.current) { videoRef.current.srcObject = s; void videoRef.current.play(); }
        raf = requestAnimationFrame(tick);
      })
      .catch(() => props.onCancel());

    return () => {
      done = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <div class="qr-scanner">
      {/* eslint-disable-next-line jsx-a11y/media-has-caption -- live camera preview, no captions apply */}
      <video ref={videoRef} playsInline muted />
      <button type="button" class="link" onClick={props.onCancel}>Cancel</button>
    </div>
  );
}
