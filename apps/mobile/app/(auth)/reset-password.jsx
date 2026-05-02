import { useState, useEffect } from 'react'
import {
  View, Text, TextInput, StyleSheet,
  KeyboardAvoidingView, Platform, TouchableOpacity, Alert,
} from 'react-native'
import { useRouter } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { colors, textStyles, spacing, borderRadius } from '../../theme'
import { Button, Icon } from '../../components/ui'

export default function ResetPasswordScreen() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [hasSession, setHasSession] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)

  // Verify the user has an active password-recovery session.
  // The deep link handler in _layout.jsx establishes the session before routing here.
  useEffect(() => {
    let mounted = true
    const verify = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (mounted) {
          setHasSession(!!session)
          setCheckingSession(false)
        }
      } catch {
        if (mounted) {
          setHasSession(false)
          setCheckingSession(false)
        }
      }
    }
    verify()

    // Watch for auth state changes — handles late-arriving session from deep link
    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
        setHasSession(true)
        setCheckingSession(false)
      }
    })

    return () => {
      mounted = false
      subscription?.subscription?.unsubscribe?.()
    }
  }, [])

  const validate = () => {
    if (!password || password.length < 8) {
      setError('Password must be at least 8 characters')
      return false
    }
    if (password !== confirm) {
      setError('Passwords don’t match')
      return false
    }
    return true
  }

  const handleSubmit = async () => {
    setError('')
    if (!validate()) return
    setLoading(true)
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) throw updateError

      Alert.alert('Password updated', 'You can now sign in with your new password.', [
        {
          text: 'Continue',
          onPress: async () => {
            await supabase.auth.signOut()
            router.replace('/(auth)/login')
          },
        },
      ])
    } catch (err) {
      setError(err.message || 'Could not update password. The link may have expired.')
    } finally {
      setLoading(false)
    }
  }

  if (checkingSession) {
    return (
      <View style={styles.container}>
        <View style={[styles.inner, styles.center]}>
          <View style={styles.spinner} />
        </View>
      </View>
    )
  }

  if (!hasSession) {
    return (
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.inner}>
          <View style={styles.logoContainer}>
            <View style={[styles.logoCircle, { backgroundColor: colors.errorLight }]}>
              <Icon name="alert-circle-outline" size="lg" color={colors.error} />
            </View>
          </View>
          <Text style={styles.title}>Link expired</Text>
          <Text style={styles.subtitle}>
            This password reset link is invalid or has expired. Request a new one from the sign-in screen.
          </Text>
          <Button
            title="Request New Link"
            onPress={() => router.replace('/(auth)/forgot-password')}
            variant="primary"
            size="lg"
            fullWidth
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
            <Icon name="lock-closed-outline" size="lg" color={colors.white} />
          </View>
        </View>
        <Text style={styles.title}>Set New Password</Text>
        <Text style={styles.subtitle}>Choose a new password for your account.</Text>

        {error ? (
          <View style={styles.errorBox}>
            <Icon name="alert-circle-outline" size="sm" color={colors.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.inputWrap}>
          <TextInput
            style={[styles.input, { paddingRight: 44 }]}
            placeholder="New password (min 8 characters)"
            placeholderTextColor={colors.neutral400}
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!show}
            autoCapitalize="none"
            autoFocus
          />
          <TouchableOpacity onPress={() => setShow(!show)} style={styles.eyeBtn}>
            <Icon name={show ? 'eye-off-outline' : 'eye-outline'} size="sm" color={colors.neutral500} />
          </TouchableOpacity>
        </View>

        <TextInput
          style={styles.input}
          placeholder="Confirm new password"
          placeholderTextColor={colors.neutral400}
          value={confirm}
          onChangeText={setConfirm}
          secureTextEntry={!show}
          autoCapitalize="none"
        />

        <Button
          title={loading ? 'Updating...' : 'Update Password'}
          onPress={handleSubmit}
          variant="primary"
          size="lg"
          fullWidth
          loading={loading}
          disabled={loading || !password || !confirm}
          style={{ marginTop: spacing.sm }}
        />
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  inner: { flex: 1, justifyContent: 'center', paddingHorizontal: spacing.xl },
  center: { alignItems: 'center' },
  spinner: { width: 36, height: 36, borderRadius: 18, borderWidth: 3, borderColor: colors.neutral200, borderTopColor: colors.primary },
  logoContainer: { alignItems: 'center', marginBottom: spacing.lg },
  logoCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  title: { ...textStyles.heading1, color: colors.neutral900, textAlign: 'center', marginBottom: spacing.xs },
  subtitle: { ...textStyles.body, color: colors.neutral500, textAlign: 'center', marginBottom: spacing['2xl'] },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.errorLight, padding: spacing.md, borderRadius: borderRadius.md, marginBottom: spacing.base },
  errorText: { ...textStyles.bodySmall, color: colors.error, flex: 1 },
  input: { backgroundColor: colors.neutral50, borderWidth: 1, borderColor: colors.neutral200, borderRadius: borderRadius.lg, padding: spacing.base, fontSize: 16, color: colors.neutral900, marginBottom: spacing.md },
  inputWrap: { position: 'relative' },
  eyeBtn: { position: 'absolute', right: spacing.base, top: 0, bottom: spacing.md, justifyContent: 'center' },
  backRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, marginTop: spacing.xl },
  backText: { fontSize: 14, color: colors.primary, fontWeight: '600' },
})
