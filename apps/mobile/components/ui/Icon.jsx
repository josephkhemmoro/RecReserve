import Ionicons from '@expo/vector-icons/Ionicons'
import { colors } from '../../theme'

const SIZES = { sm: 16, md: 22, lg: 28 }

export function Icon({ name, size = 'md', color = colors.neutral700, style }) {
  return (
    <Ionicons name={name} size={SIZES[size] || size} color={color} style={style} />
  )
}
