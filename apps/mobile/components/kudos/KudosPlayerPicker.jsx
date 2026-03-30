import { useState, useEffect, useRef, useCallback } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Modal,
  StyleSheet,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { supabase } from '../../lib/supabase'
import { useKudosStore } from '../../store/kudosStore'

function getInitials(name) {
  if (!name) return '?'
  return name.split(/\s+/).slice(0, 2).map((w) => w[0] || '').join('').toUpperCase()
}

export function KudosPlayerPicker({
  visible,
  clubId,
  reservationId,
  senderId,
  onClose,
  onKudosSent,
}) {
  const { sendKudos, isSending } = useKudosStore()
  const [search, setSearch] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const debounceRef = useRef(null)

  const doSearch = useCallback(async (query) => {
    if (!clubId || !query.trim()) {
      setResults([])
      return
    }
    setSearching(true)
    try {
      const { data, error } = await supabase
        .from('memberships')
        .select('user_id, users:users!memberships_user_id_fkey(id, full_name, avatar_url)')
        .eq('club_id', clubId)
        .eq('is_active', true)
        .neq('user_id', senderId)
        .ilike('users.full_name', `%${query.trim()}%`)
        .limit(20)

      if (error) throw error

      // Filter out any rows where user join returned null (ILIKE filter on join)
      const members = (data || [])
        .filter((m) => m.users && m.users.full_name)
        .map((m) => m.users)

      setResults(members)
    } catch (err) {
      console.error('Error searching members:', err)
      setResults([])
    } finally {
      setSearching(false)
    }
  }, [clubId, senderId])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!search.trim()) {
      setResults([])
      return
    }
    debounceRef.current = setTimeout(() => doSearch(search), 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [search, doSearch])

  // Reset on close
  useEffect(() => {
    if (!visible) {
      setSearch('')
      setResults([])
    }
  }, [visible])

  const handleSelect = async (member) => {
    const success = await sendKudos(senderId, member.id, reservationId, clubId)
    if (success) {
      onKudosSent()
    }
  }

  const renderMember = ({ item }) => (
    <TouchableOpacity
      style={styles.memberRow}
      onPress={() => handleSelect(item)}
      disabled={isSending}
    >
      {item.avatar_url ? (
        <Image source={{ uri: item.avatar_url }} style={styles.avatar} />
      ) : (
        <View style={styles.avatarFallback}>
          <Text style={styles.avatarText}>{getInitials(item.full_name)}</Text>
        </View>
      )}
      <Text style={styles.memberName}>{item.full_name}</Text>
      {isSending && <ActivityIndicator size="small" color="#FF8A65" />}
    </TouchableOpacity>
  )

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Send Kudos 🤝</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#64748b" />
            </TouchableOpacity>
          </View>

          <TextInput
            style={styles.searchInput}
            placeholder="Search club members..."
            placeholderTextColor="#9ca3af"
            value={search}
            onChangeText={setSearch}
            autoFocus
          />

          {searching ? (
            <View style={styles.centered}>
              <ActivityIndicator size="small" color="#2563eb" />
            </View>
          ) : results.length === 0 && search.trim() ? (
            <View style={styles.centered}>
              <Text style={styles.emptyText}>No members found</Text>
            </View>
          ) : (
            <FlatList
              data={results}
              renderItem={renderMember}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              keyboardShouldPersistTaps="handled"
            />
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
    paddingBottom: 34,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1e293b',
  },
  searchInput: {
    marginHorizontal: 20,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: '#1e293b',
    marginBottom: 12,
  },
  centered: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#94a3b8',
  },
  listContent: {
    paddingHorizontal: 20,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    gap: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarFallback: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748b',
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    flex: 1,
  },
})
