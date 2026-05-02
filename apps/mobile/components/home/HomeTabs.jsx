import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native'
import { colors, textStyles, spacing } from '../../theme'

const TABS = ['About', 'Book', 'Play', 'Memberships', 'Events']

export function HomeTabs({ activeTab, onChangeTab }) {
  return (
    <View style={styles.wrapper}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.container}
        bounces={false}
      >
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => onChangeTab(tab)}
            activeOpacity={0.7}
          >
            <Text
              style={[styles.tabText, activeTab === tab && styles.tabTextActive]}
              numberOfLines={1}
            >
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral150,
  },
  container: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
  },
  tab: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: colors.primary },
  tabText: { ...textStyles.label, color: colors.neutral400 },
  tabTextActive: { color: colors.neutral900 },
})
