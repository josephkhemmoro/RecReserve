import { useState } from 'react'
import {
  View, Text, TextInput, StyleSheet,
  KeyboardAvoidingView, Platform,
} from 'react-native'
import { Link } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { colors, textStyles, spacing, borderRadius } from '../../theme'
import { Button, Icon } from '../../components/ui'

export default function LoginScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async () => {
    if (!email || !password) { setError('Please fill in all fields'); return }
    setError(''); setLoading(true)
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (signInError) setError(signInError.message)
    } catch { setError('An unexpected error occurred') } finally { setLoading(false) }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.inner}>
        <View style={styles.logoContainer}>
          <View style={styles.logoCircle}>
            <Icon name="tennisball" size="lg" color={colors.white} />
          </View>
        </View>
        <Text style={styles.title}>RecReserve</Text>
        <Text style={styles.subtitle}>Sign in to your account</Text>

        {error ? (
          <View style={styles.errorBox}>
            <Icon name="alert-circle-outline" size="sm" color={colors.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <TextInput style={styles.input} placeholder="Email" placeholderTextColor={colors.neutral400} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
        <TextInput style={styles.input} placeholder="Password" placeholderTextColor={colors.neutral400} value={password} onChangeText={setPassword} secureTextEntry />

        <Button title={loading ? 'Signing In...' : 'Sign In'} onPress={handleLogin} variant="primary" size="lg" fullWidth loading={loading} disabled={loading} style={{ marginTop: spacing.sm }} />

        <Link href="/(auth)/register" asChild>
          <Text style={styles.linkText}>
            Don't have an account? <Text style={styles.linkBold}>Sign Up</Text>
          </Text>
        </Link>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  inner: { flex: 1, justifyContent: 'center', paddingHorizontal: spacing.xl },
  logoContainer: { alignItems: 'center', marginBottom: spacing.lg },
  logoCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  title: { ...textStyles.heading1, color: colors.neutral900, textAlign: 'center', marginBottom: spacing.xs },
  subtitle: { ...textStyles.body, color: colors.neutral500, textAlign: 'center', marginBottom: spacing['2xl'] },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.errorLight, padding: spacing.md, borderRadius: borderRadius.md, marginBottom: spacing.base },
  errorText: { ...textStyles.bodySmall, color: colors.error, flex: 1 },
  input: { backgroundColor: colors.neutral50, borderWidth: 1, borderColor: colors.neutral200, borderRadius: borderRadius.lg, padding: spacing.base, fontSize: 16, color: colors.neutral900, marginBottom: spacing.md },
  linkText: { ...textStyles.bodySmall, color: colors.neutral500, textAlign: 'center', marginTop: spacing.xl },
  linkBold: { color: colors.primary, fontWeight: '600' },
})
