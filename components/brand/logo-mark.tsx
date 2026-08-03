/**
 * Marca de Relojes Carrasco: escudo con el monograma "RC".
 *
 * Vectorial (hereda color con currentColor) para verse nítida en
 * cualquier tamaño y sobre cualquier fondo, clara u oscura.
 *
 * NOTA: esta es una reconstrucción vectorial propia inspirada en el
 * isologo real del negocio (escudo + "RC" + agujas de reloj). No es
 * el archivo original en píxeles: para usar el logo definitivo tal
 * cual, agregar el archivo a public/logo.png (o .svg) y reemplazar
 * este componente por una etiqueta <Image>.
 */
export function LogoMark({
  className,
  size = 24,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <svg
      viewBox="0 0 48 52"
      width={size}
      height={size}
      className={className}
      fill="none"
      stroke="currentColor"
      role="img"
      aria-label="Relojes Carrasco"
    >
      {/* Escudo — borde doble */}
      <path
        d="M24 2 L44 9 V25 C44 37 36 45.5 24 50 C12 45.5 4 37 4 25 V9 Z"
        strokeWidth="1.6"
      />
      <path
        d="M24 6 L40 11.5 V25 C40 34.8 33.6 41.8 24 45.8 C14.4 41.8 8 34.8 8 25 V11.5 Z"
        strokeWidth="1"
        opacity="0.6"
      />

      {/* R */}
      <path
        d="M16 15 V33 M16 15 H23 C26 15 28 17 28 20 C28 23 26 25 23 25 H16 M22 25 L29 33"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* C como esfera de reloj: arco abierto + agujas */}
      <path
        d="M33.5 24.3 A7 7 0 1 1 33.5 33.7"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="29" cy="29" r="1.4" fill="currentColor" stroke="none" />
      <path
        d="M29 29 L23 21 M29 29 L25 33"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
