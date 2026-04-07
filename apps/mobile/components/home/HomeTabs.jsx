import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { colors, textStyles, spacing } from '../../theme'

const TABS = ['About', 'Book', 'Play', 'Memberships', 'Events']

export function HomeTabs({ activeTab, onChangeTab }) {
  return (
    <View style={styles.container}>
      {TABS.map((tab) => (
        <TouchableOpacity
          key={tab}
          style={[styles.tab, activeTab === tab && styles.tabActive]}
          onPress={() => onChangeTab(tab)}
        >
          <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text>
        </TouchableOpacity>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row', backgroundColor: colors.white,
    borderBottomWidth: 1, borderBottomColor: colors.neutral150,
  },
  tab: {
    flex: 1, alignItems: 'center', paddingVertical: spacing.md,
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: colors.primary },
  tabText: { ...textStyles.label, color: colors.neutral400 },
  tabTextActive: { color: colors.neutral900 },
})
