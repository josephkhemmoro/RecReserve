import { useState } from 'react'
import {
  View, Text, TextInput, StyleSheet,
  KeyboardAvoidingView, Platform, TouchableOpacity,
} from 'react-native'
import { Link, useRouter } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { colors, textStyles, spacing, borderRadius } from '../../theme'
import { Button, Icon } from '../../components/ui'

export default function ForgotPasswordScreen() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  const handleSubmit = async () => {
    if (!email.trim()) {
      setError('Please enter your email')
      return
    }
    setError('')
    setLoading(true)
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email.trim().toLowerCase(),
        { redirectTo: 'recreserve://reset-password' }
      )
      if (resetError) throw resetError
      setSent(true)
    } catch (err) {
      setError(err.message || 'Could not send reset email. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.inner}>
          <View style={styles.logoContainer}>
            <View style={[styles.logoCircle, { backgroundColor: colors.successLight }]}>
              <Icon name="mail-outline" size="lg" color={colors.success} />
            </View>
          </View>
          <Text style={styles.title}>Check your email</Text>
          <Text style={styles.subtitle}>
            If an account exists for{'\n'}
            <Text style={styles.emailMono}>{email.trim().toLowerCase()}</Text>{'\n'}
            we&apos;ve sent a password reset link.
          </Text>

          <View style={styles.helpBox}>
            <Text style={styles.helpText}>
              The link expires in 1 hour. Tap it on this device to open the app and set a new password.
            </Text>
            <Text style={[styles.helpText, { marginTop: spacing.sm }]}>
              Don&apos;t see it? Check your spam folder, or wait a minute and tap &quot;Resend&quot; below.
            </Text>
          </View>

          <Button
            title="Resend Email"
            onPress={() => { setSent(false); handleSubmit() }}
            variant="secondary"
            size="lg"
            fullWidth
            disabled={loading}
            style={{ marginTop: spacing.base }}
          />

          <TouchableOpacity onPress={() => router.replace('/(auth)/login')} style={styles.backRow}>
            <Icon name="arrow-back" size="sm" color={colors.primary} />
            <Text style={styles.backText}>Back to Sign In</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    )
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.inner}>
        <View style={styles.logoContainer}>
          <View style={styles.logoCircle}>
            <Icon name="key-outline" size="lg" color={colors.white} />
          </View>
        </View>
        <Text style={styles.title}>Reset Your Password</Text>
        <Text style={styles.subtitle}>
          Enter your email and we&apos;ll send you a link to reset your password.
        </Text>

        {error ? (
          <View style={styles.errorBox}>
            <Icon name="alert-circle-outline" size="sm" color={colors.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={colors.neutral400}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoFocus
        />

        <Button
          title={loading ? 'Sending...' : 'Send Reset Link'}
          onPress={handleSubmit}
          variant="primary"
          size="lg"
          fullWidth
          loading={loading}
          disabled={loading || !email.trim()}
          style={{ marginTop: spacing.sm }}
        />

        <Link href="/(auth)/login" asChild>
          <TouchableOpacity style={styles.backRow}>
            <Icon name="arrow-back" size="sm" color={colors.primary} />
            <Text style={styles.backText}>Back to Sign In</Text>
          </TouchableOpacity>
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
  subtitle: { ...textStyles.body, color: colors.neutral500, textAlign: 'center', marginBottom: spacing['2xl'], lineHeight: 22 },
  emailMono: { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontWeight: '600', color: colors.neutral800 },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.errorLight, padding: spacing.md, borderRadius: borderRadius.md, marginBottom: spacing.base },
  errorText: { ...textStyles.bodySmall, color: colors.error, flex: 1 },
  input: { backgroundColor: colors.neutral50, borderWidth: 1, borderColor: colors.neutral200, borderRadius: borderRadius.lg, padding: spacing.base, fontSize: 16, color: colors.neutral900, marginBottom: spacing.md },
  helpBox: { backgroundColor: colors.neutral50, borderRadius: borderRadius.md, padding: spacing.base, marginTop: spacing.md, borderWidth: 1, borderColor: colors.neutral100 },
  helpText: { fontSize: 13, color: colors.neutral600, lineHeight: 19 },
  backRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, marginTop: spacing.xl },
  backText: { fontSize: 14, color: colors.primary, fontWeight: '600' },
})
