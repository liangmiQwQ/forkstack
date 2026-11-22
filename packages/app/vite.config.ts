import { liangmi } from '@liangmi/vp-config'
import { voidReact } from '@void/react/plugin'
import UnoCSS from 'unocss/vite'
import { voidPlugin } from 'void'

export default liangmi({
  // Void's generated `@auth-schema` alias lives in tsconfig `paths`, which Vite ignores by default.
  resolve: { tsconfigPaths: true },
  plugins: [
    voidPlugin(),
    voidReact({ react: { compiler: true }, viewTransitions: true }),
    UnoCSS(`${import.meta.dirname}/uno.config.ts`)
  ]
})
