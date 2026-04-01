import { View, StyleSheet } from 'react-native'
import { colors, spacing } from '../../theme'

export function Divider({ marginV = spacing.base }) {
  return <View style={[styles.line, { marginVertical: marginV }]} />
}

const styles = StyleSheet.create({
  line: { height: 1, backgroundColor: colors.neutral150 },
})
