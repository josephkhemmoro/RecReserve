import { useState } from 'react'
import { Alert, StyleSheet } from 'react-native'
import { colors } from '../../theme'
import { Button } from '../ui'

export function StreakFreezeButton({ freezesRemaining, currentStreak, onFreeze }) {
  const [loading, setLoading] = useState(false)

  if (currentStreak === 0) return null

  const handlePress = () => {
    Alert.alert('Use Streak Freeze?', `Your streak will be protected if you don't play this week. You have ${freezesRemaining} freeze(s) remaining this month.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Use Freeze', onPress: async () => {
        setLoading(true)
        try {
          const success = await onFreeze()
          if (!success) Alert.alert('Failed', 'Could not activate streak freeze.')
        } catch { Alert.alert('Error', 'Something went wrong.') } finally { setLoading(false) }
      }},
    ])
  }

  return (
    <Button
      title={freezesRemaining === 0 ? 'No freezes left (resets monthly)' : `Freeze My Streak (${freezesRemaining} left)`}
      onPress={handlePress}
      variant="secondary"
      size="md"
      fullWidth
      icon="snow-outline"
      disabled={freezesRemaining === 0 || loading}
      loading={loading}
    />
  )
}
