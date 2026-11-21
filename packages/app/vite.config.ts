import { liangmi } from '@liangmi/vp-config'
import { voidReact } from '@void/react/plugin'
import { voidPlugin } from 'void'

export default liangmi({
  plugins: [voidPlugin(), voidReact({ react: { compiler: true } })]
})
