import { toString as qrToString } from "qrcode";
import { useEffect, useState } from "preact/hooks";

export function QrCode(props: { url: string }) {
  const [svg, setSvg] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void qrToString(props.url, { type: "svg", margin: 1 }).then((s) => { if (live) setSvg(s); });
    return () => { live = false; };
  }, [props.url]);

  if (svg === null) return null;
  return <div class="qrcode" dangerouslySetInnerHTML={{ __html: svg }} />;
}
