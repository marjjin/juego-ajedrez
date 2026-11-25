# Ajedrez 3D

Ajedrez en 3D (three.js + React) para jugar contra la computadora u online con Supabase.

## Puesta en marcha

1. `npm install`
2. Copiá `.env.example` a `.env` y completá la URL y la clave publicable de Supabase.
3. En Supabase, abrí **SQL Editor**, pegá `supabase/schema.sql` y ejecutalo una vez. Crea la tabla `chess_rooms` y la activa para tiempo real.
4. `npm run dev`

## Cómo se juega

- Al entrar se pide solo un nombre de usuario (queda guardado en el navegador).
- **Contra la computadora**: elegís color y nivel (Fácil, Normal, Difícil). Podés deshacer jugadas.
- **Online**: creás una sala y pasás el código o el enlace (`#sala=CODIGO`), o entrás a una sala abierta de la lista. Se puede ofrecer tablas, abandonar y pedir revancha (se cambian los colores). Si entra una tercera persona a una sala llena, mira la partida.
- Click en una pieza para ver sus jugadas y click en la casilla de destino. Arrastrá para girar la cámara y usá la rueda para acercar.

## Estructura

- `src/three/` escena 3D, tablero y modelos de las piezas.
- `src/lib/ai.worker.js` motor de la computadora (alfa-beta en un Web Worker).
- `src/components/` pantallas y lógica de partida local y online.
- `supabase/schema.sql` tabla, permisos y tiempo real.

## Limitación conocida

No hay cuentas: cualquiera con la clave publicable puede modificar salas. Alcanza para jugar entre amigos; para algo público conviene sumar Supabase Auth (anónimo) y políticas por jugador.
