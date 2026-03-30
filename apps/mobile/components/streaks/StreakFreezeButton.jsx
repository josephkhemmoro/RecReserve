import { useState } from 'react'
import { TouchableOpacity, Text, Alert, ActivityIndicator, StyleSheet } from 'react-native'

export function StreakFreezeButton({ freezesRemaining, currentStreak, onFreeze }) {
  const [loading, setLoading] = useState(false)

  if (currentStreak === 0) return null

  const handlePress = () => {
    Alert.alert(
      'Use Streak Freeze?',
      `Your streak will be protected if you don't play this week. You have ${freezesRemaining} freeze(s) remaining this month.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Use Freeze',
          onPress: async () => {
            setLoading(true)
            try {
              const success = await onFreeze()
              if (!success) {
                Alert.alert('Failed', 'Could not activate streak freeze. Please try again.')
              }
            } catch {
              Alert.alert('Error', 'Something went wrong. Please try again.')
            } finally {
              setLoading(false)
            }
          },
        },
      ]
    )
  }

  const disabled = freezesRemaining === 0

  return (
    <TouchableOpacity
      style={[styles.button, disabled && styles.buttonDisabled]}
      onPress={handlePress}
      disabled={disabled || loading}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator size="small" color="#4FC3F7" />
      ) : (
        <Text style={[styles.buttonText, disabled && styles.buttonTextDisabled]}>
          {disabled
            ? '🧊 No freezes left (resets monthly)'
            : `🧊 Freeze My Streak (${freezesRemaining} left)`}
        </Text>
      )}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  button: {
    borderWidth: 1.5,
    borderColor: '#4FC3F7',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    backgroundColor: '#f0f9ff',
  },
  buttonDisabled: {
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0288D1',
  },
  buttonTextDisabled: {
    color: '#94a3b8',
  },
})
