import { useState, useEffect } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { useRouter } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import { supabase } from '../../lib/supabase'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useAuthStore } from '../../store/authStore'
import { useClubStore } from '../../store/clubStore'
import { useMembershipStore } from '../../store/membershipStore'

export default function ProfileScreen() {
  const router = useRouter()
  const { user, clearAuth } = useAuthStore()
  const { selectedClub, clearClub } = useClubStore()
  const { tier, membership, loading: tierLoading, clearMembership } = useMembershipStore()

  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [avatarUrl, setAvatarUrl] = useState(null)

  useEffect(() => {
    fetchProfile()
  }, [user?.id])

  const fetchProfile = async () => {
    if (!user?.id) return
    try {
      const { data, error } = await supabase
        .from('users')
        .select('full_name, email, phone, avatar_url')
        .eq('id', user.id)
        .single()

      if (error) throw error
      setFullName(data.full_name || '')
      setEmail(data.email || user.email || '')
      setPhone(data.phone || '')
      setAvatarUrl(data.avatar_url || null)
    } catch (err) {
      console.error('Error fetching profile:', err)
      setFullName(user?.user_metadata?.full_name || '')
      setEmail(user?.email || '')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const { error } = await supabase
        .from('users')
        .update({ full_name: fullName.trim(), phone: phone.trim() })
        .eq('id', user?.id)

      if (error) throw error
      setEditing(false)
    } catch (err) {
      Alert.alert('Error', 'Failed to save profile')
    } finally {
      setSaving(false)
    }
  }

  const handleAvatarPick = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'We need access to your photos to set an avatar.')
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    })

    if (result.canceled) return

    setUploading(true)
    try {
      const file = result.assets[0]
      const ext = file.uri.split('.').pop()?.toLowerCase() || 'jpg'
      const filePath = `${user?.id}.${ext}`

      // Read file as ArrayBuffer (blob doesn't work reliably in React Native)
      const response = await fetch(file.uri)
      const arrayBuffer = await response.arrayBuffer()

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, arrayBuffer, {
          upsert: true,
          contentType: file.mimeType || `image/${ext === 'jpg' ? 'jpeg' : ext}`,
        })

      if (uploadError) throw uploadError

      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath)

      const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`

      const { error: updateError } = await supabase
        .from('users')
        .update({ avatar_url: publicUrl })
        .eq('id', user?.id)

      if (updateError) throw updateError
      setAvatarUrl(publicUrl)
    } catch (err) {
      console.error('Upload error:', err)
      Alert.alert('Error', err.message || 'Failed to upload avatar')
    } finally {
      setUploading(false)
    }
  }

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut()
      clearAuth()
      clearClub()
      clearMembership()
    } catch {
      // handled by auth listener
    }
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleAvatarPick} style={styles.avatarContainer}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarText}>
                  {fullName.charAt(0).toUpperCase() || 'U'}
                </Text>
              </View>
            )}
            {uploading && (
              <View style={styles.avatarOverlay}>
                <ActivityIndicator color="#ffffff" />
              </View>
            )}
            <View style={styles.editAvatarBadge}>
              <Text style={styles.editAvatarText}>Edit</Text>
            </View>
          </TouchableOpacity>

          {selectedClub && (
            <View style={styles.clubBadge}>
              <Text style={styles.clubBadgeText}>{selectedClub.name}</Text>
            </View>
          )}
        </View>

        {/* Membership Card */}
        {selectedClub && (
          <View style={styles.membershipSection}>
            {tierLoading ? (
              <View style={styles.membershipCard}>
                <View style={[styles.skeletonBar, { width: '50%', height: 14 }]} />
                <View style={[styles.skeletonBar, { width: '70%', height: 12, marginTop: 8 }]} />
              </View>
            ) : tier ? (
              <View style={[styles.membershipCard, { borderLeftColor: tier.color || '#2563eb' }]}>
                <View style={styles.membershipHeader}>
                  <View style={[styles.tierDot, { backgroundColor: tier.color || '#2563eb' }]} />
                  <Text style={styles.tierName}>{tier.name}</Text>
                </View>
                {tier.can_book_free ? (
                  <View style={styles.freeBadge}>
                    <Ionicons name="checkmark-circle" size={14} color="#15803d" />
                    <Text style={styles.freeBadgeText}>Books free — no charge for court bookings</Text>
                  </View>
                ) : tier.discount_percent > 0 ? (
                  <View style={styles.discountBadge}>
                    <Ionicons name="pricetag" size={14} color="#2563eb" />
                    <Text style={styles.discountBadgeText}>
                      {tier.discount_percent}% off court bookings
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.tierSubtext}>Standard pricing</Text>
                )}
              </View>
            ) : membership ? (
              <View style={styles.membershipCard}>
                <Text style={styles.tierName}>{membership.tier}</Text>
                <Text style={styles.tierSubtext}>No pricing tier configured</Text>
              </View>
            ) : (
              <View style={styles.membershipCardMuted}>
                <Ionicons name="information-circle-outline" size={18} color="#94a3b8" />
                <Text style={styles.noTierText}>No membership tier — contact your club</Text>
              </View>
            )}
          </View>
        )}

        {/* Profile Fields */}
        <View style={styles.fields}>
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Full Name</Text>
            {editing ? (
              <TextInput
                style={styles.fieldInput}
                value={fullName}
                onChangeText={setFullName}
                placeholder="Your name"
                placeholderTextColor="#9ca3af"
              />
            ) : (
              <Text style={styles.fieldValue}>{fullName || '—'}</Text>
            )}
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Email</Text>
            <Text style={styles.fieldValueMuted}>{email}</Text>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Phone</Text>
            {editing ? (
              <TextInput
                style={styles.fieldInput}
                value={phone}
                onChangeText={setPhone}
                placeholder="Phone number"
                placeholderTextColor="#9ca3af"
                keyboardType="phone-pad"
              />
            ) : (
              <Text style={styles.fieldValue}>{phone || 'Not set'}</Text>
            )}
          </View>

          {editing ? (
            <View style={styles.editActions}>
              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleSave}
                disabled={saving}
              >
                <Text style={styles.saveButtonText}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.cancelEditButton}
                onPress={() => { setEditing(false); fetchProfile() }}
              >
                <Text style={styles.cancelEditText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => setEditing(true)}
            >
              <Text style={styles.editButtonText}>Edit Profile</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity style={styles.switchButton} onPress={() => router.push('/(tabs)/clubs')}>
            <Text style={styles.switchButtonText}>Switch Club</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', paddingTop: 70 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc' },
  header: { alignItems: 'center', paddingBottom: 20 },
  avatarContainer: { position: 'relative', marginBottom: 12 },
  avatarImage: { width: 88, height: 88, borderRadius: 44 },
  avatarFallback: { width: 88, height: 88, borderRadius: 44, backgroundColor: '#2563eb', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 32, fontWeight: '700', color: '#ffffff' },
  avatarOverlay: { ...StyleSheet.absoluteFillObject, borderRadius: 44, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  editAvatarBadge: { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#1e293b', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  editAvatarText: { color: '#ffffff', fontSize: 10, fontWeight: '700' },
  clubBadge: { backgroundColor: '#eff6ff', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
  clubBadgeText: { fontSize: 13, fontWeight: '600', color: '#2563eb' },

  // Membership card
  membershipSection: { paddingHorizontal: 24, paddingTop: 16 },
  membershipCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    borderLeftWidth: 4,
    borderLeftColor: '#2563eb',
  },
  membershipCardMuted: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  membershipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  tierDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  tierName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
    textTransform: 'capitalize',
  },
  tierSubtext: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 2,
  },
  freeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  freeBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#15803d',
  },
  discountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#eff6ff',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  discountBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2563eb',
  },
  noTierText: {
    fontSize: 14,
    color: '#94a3b8',
    flex: 1,
  },
  skeletonBar: {
    backgroundColor: '#f1f5f9',
    borderRadius: 6,
  },

  fields: { paddingHorizontal: 24, paddingTop: 16 },
  fieldGroup: { marginBottom: 20 },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase', marginBottom: 6 },
  fieldValue: { fontSize: 16, color: '#1e293b', fontWeight: '500' },
  fieldValueMuted: { fontSize: 16, color: '#64748b' },
  fieldInput: { fontSize: 16, color: '#1e293b', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, padding: 12, backgroundColor: '#ffffff' },
  editActions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  saveButton: { flex: 1, backgroundColor: '#2563eb', borderRadius: 12, padding: 14, alignItems: 'center' },
  saveButtonText: { color: '#ffffff', fontSize: 15, fontWeight: '600' },
  cancelEditButton: { flex: 1, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 14, alignItems: 'center' },
  cancelEditText: { color: '#64748b', fontSize: 15, fontWeight: '600' },
  editButton: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 14, alignItems: 'center', backgroundColor: '#ffffff', marginTop: 4 },
  editButtonText: { color: '#2563eb', fontSize: 15, fontWeight: '600' },
  actions: { paddingHorizontal: 24, paddingTop: 32, paddingBottom: 40, gap: 12 },
  switchButton: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 16, alignItems: 'center', backgroundColor: '#ffffff' },
  switchButtonText: { color: '#2563eb', fontSize: 16, fontWeight: '600' },
  signOutButton: { borderWidth: 1, borderColor: '#fecaca', borderRadius: 12, padding: 16, alignItems: 'center', backgroundColor: '#fef2f2' },
  signOutText: { color: '#dc2626', fontSize: 16, fontWeight: '600' },
})
