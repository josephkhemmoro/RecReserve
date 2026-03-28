import { useEffect } from 'react'
import { View, ActivityIndicator, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'

export default function SportSelectionScreen() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/courts/select')
  }, [])

  return (
    <View style={styles.centered}>
      <ActivityIndicator size="large" color="#2563eb" />
    </View>
  )
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc' },
})
