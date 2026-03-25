import { Redirect } from 'expo-router'
import { useAuthStore } from '../store/authStore'

export default function Index() {
  const { session } = useAuthStore()

  if (session) {
    return <Redirect href="/(tabs)" />
  }

  return <Redirect href="/(auth)/login" />
}
