import { useState, useEffect, useRef, useCallback } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, FlatList, Modal,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native'
import { supabase } from '../../lib/supabase'
import { useKudosStore } from '../../store/kudosStore'
import { colors, textStyles, spacing, borderRadius } from '../../theme'
import { Icon, Avatar } from '../ui'

export function KudosPlayerPicker({ visible, clubId, reservationId, senderId, onClose, onKudosSent }) {
  const { sendKudos, isSending } = useKudosStore()
  const [search, setSearch] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const debounceRef = useRef(null)

  const doSearch = useCallback(async (query) => {
    if (!clubId || !query.trim()) { setResults([]); return }
    setSearching(true)
    try {
      const { data, error } = await supabase.from('memberships').select('user_id, users:users!memberships_user_id_fkey(id, full_name, avatar_url)').eq('club_id', clubId).eq('is_active', true).neq('user_id', senderId).ilike('users.full_name', `%${query.trim()}%`).limit(20)
      if (error) throw error
      setResults((data || []).filter((m) => m.users && m.users.full_name).map((m) => m.users))
    } catch { setResults([]) } finally { setSearching(false) }
  }, [clubId, senderId])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!search.trim()) { setResults([]); return }
    debounceRef.current = setTimeout(() => doSearch(search), 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [search, doSearch])

  useEffect(() => { if (!visible) { setSearch(''); setResults([]) } }, [visible])

  const handleSelect = async (member) => {
    const success = await sendKudos(senderId, member.id, reservationId, clubId)
    if (success) onKudosSent()
  }

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Send Kudos</Text>
            <TouchableOpacity onPress={onClose}><Icon name="close" size="md" color={colors.neutral500} /></TouchableOpacity>
          </View>
          <TextInput style={styles.searchInput} placeholder="Search club members..." placeholderTextColor={colors.neutral400} value={search} onChangeText={setSearch} autoFocus />
          {searching ? (
            <View style={styles.centered}><ActivityIndicator size="small" color={colors.primary} /></View>
          ) : results.length === 0 && search.trim() ? (
            <View style={styles.centered}><Text style={styles.emptyText}>No members found</Text></View>
          ) : (
            <FlatList data={results} keyExtractor={(item) => item.id} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.listContent}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.memberRow} onPress={() => handleSelect(item)} disabled={isSending}>
                  <Avatar uri={item.avatar_url} name={item.full_name} size="md" />
                  <Text style={styles.memberName}>{item.full_name}</Text>
                  {isSending && <ActivityIndicator size="small" color={colors.primary} />}
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.white, borderTopLeftRadius: borderRadius.xl, borderTopRightRadius: borderRadius.xl, maxHeight: '70%', paddingBottom: 34 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.md },
  sheetTitle: { ...textStyles.heading3, color: colors.neutral900 },
  searchInput: { marginHorizontal: spacing.lg, backgroundColor: colors.neutral50, borderWidth: 1, borderColor: colors.neutral200, borderRadius: borderRadius.md, padding: spacing.md, fontSize: 15, color: colors.neutral900, marginBottom: spacing.md },
  centered: { paddingVertical: spacing['3xl'], alignItems: 'center' },
  emptyText: { ...textStyles.bodySmall, color: colors.neutral400 },
  listContent: { paddingHorizontal: spacing.lg },
  memberRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.neutral100, gap: spacing.md },
  memberName: { ...textStyles.bodyMedium, color: colors.neutral900, flex: 1 },
})
