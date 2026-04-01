import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native'
import { Link } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { colors, textStyles, spacing, borderRadius } from '../../theme'
import { Button, Icon } from '../../components/ui'

export default function RegisterScreen() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleRegister = async () => {
    if (!fullName || !email || !password || !confirmPassword) { setError('Please fill in all fields'); return }
    if (password !== confirmPassword) { setError('Passwords do not match'); return }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return }
    setError(''); setLoading(true)
    try {
      const { error: signUpError } = await supabase.auth.signUp({ email: email.trim(), password, options: { data: { full_name: fullName.trim() } } })
      if (signUpError) setError(signUpError.message)
      else setSuccess(true)
    } catch { setError('An unexpected error occurred') } finally { setLoading(false) }
  }

  if (success) {
    return (
      <View style={styles.container}>
        <View style={styles.inner}>
          <View style={styles.successIcon}><Icon name="mail-outline" size="lg" color={colors.primary} /></View>
          <Text style={styles.title}>Check Your Email</Text>
          <Text style={styles.successText}>We've sent a confirmation link to {email}. Please check your inbox to verify your account.</Text>
          <Link href="/(auth)/login" asChild>
            <Button title="Back to Sign In" onPress={() => {}} variant="primary" size="lg" fullWidth />
          </Link>
        </View>
      </View>
    )
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.inner}>
          <View style={styles.logoContainer}><View style={styles.logoCircle}><Icon name="tennisball" size="lg" color={colors.white} /></View></View>
          <Text style={styles.title}>RecReserve</Text>
          <Text style={styles.subtitle}>Create your account</Text>

          {error ? (
            <View style={styles.errorBox}><Icon name="alert-circle-outline" size="sm" color={colors.error} /><Text style={styles.errorText}>{error}</Text></View>
          ) : null}

          <TextInput style={styles.input} placeholder="Full Name" placeholderTextColor={colors.neutral400} value={fullName} onChangeText={setFullName} autoCapitalize="words" />
          <TextInput style={styles.input} placeholder="Email" placeholderTextColor={colors.neutral400} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
          <TextInput style={styles.input} placeholder="Password" placeholderTextColor={colors.neutral400} value={password} onChangeText={setPassword} secureTextEntry />
          <TextInput style={styles.input} placeholder="Confirm Password" placeholderTextColor={colors.neutral400} value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry />

          <Button title={loading ? 'Creating Account...' : 'Create Account'} onPress={handleRegister} variant="primary" size="lg" fullWidth loading={loading} disabled={loading} style={{ marginTop: spacing.sm }} />

          <Link href="/(auth)/login" asChild>
            <Text style={styles.linkText}>Already have an account? <Text style={styles.linkBold}>Sign In</Text></Text>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  scrollContent: { flexGrow: 1 },
  inner: { flex: 1, justifyContent: 'center', paddingHorizontal: spacing.xl, paddingVertical: spacing['4xl'] },
  logoContainer: { alignItems: 'center', marginBottom: spacing.lg },
  logoCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  title: { ...textStyles.heading1, color: colors.neutral900, textAlign: 'center', marginBottom: spacing.xs },
  subtitle: { ...textStyles.body, color: colors.neutral500, textAlign: 'center', marginBottom: spacing['2xl'] },
  successIcon: { alignItems: 'center', marginBottom: spacing.lg },
  successText: { ...textStyles.body, color: colors.neutral500, textAlign: 'center', lineHeight: 24, marginBottom: spacing['2xl'], paddingHorizontal: spacing.base },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.errorLight, padding: spacing.md, borderRadius: borderRadius.md, marginBottom: spacing.base },
  errorText: { ...textStyles.bodySmall, color: colors.error, flex: 1 },
  input: { backgroundColor: colors.neutral50, borderWidth: 1, borderColor: colors.neutral200, borderRadius: borderRadius.lg, padding: spacing.base, fontSize: 16, color: colors.neutral900, marginBottom: spacing.md },
  linkText: { ...textStyles.bodySmall, color: colors.neutral500, textAlign: 'center', marginTop: spacing.xl },
  linkBold: { color: colors.primary, fontWeight: '600' },
})
