import Script from "next/script";

/**
 * Meta Pixel (medición de campañas de Instagram/Facebook).
 *
 * Solo se carga si NEXT_PUBLIC_META_PIXEL_ID está configurada: sin esa
 * variable el sitio no carga ningún script de terceros. El ID se valida
 * como numérico antes de insertarlo en el script.
 */
export function MetaPixel() {
  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;
  if (!pixelId || !/^\d{5,20}$/.test(pixelId)) return null;

  return (
    <>
      <Script id="meta-pixel" strategy="afterInteractive">
        {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init','${pixelId}');fbq('track','PageView');`}
      </Script>
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          height="1"
          width="1"
          style={{ display: "none" }}
          alt=""
          src={`https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1`}
        />
      </noscript>
    </>
  );
}

/** true si el Pixel está activo (para adaptar el texto de privacidad). */
export function isMetaPixelEnabled(): boolean {
  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;
  return Boolean(pixelId && /^\d{5,20}$/.test(pixelId));
}
