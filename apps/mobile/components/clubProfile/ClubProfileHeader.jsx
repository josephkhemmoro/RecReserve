import { View, Text, TouchableOpacity, Image, Linking, StyleSheet } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'

function getInitials(name) {
  if (!name) return '?'
  return name.split(/\s+/).slice(0, 2).map((w) => w[0] || '').join('').toUpperCase()
}

export function ClubProfileHeader({ club, courtCount, memberCount, isMember, onJoin }) {
  return (
    <View style={styles.container}>
      {club.logo_url ? (
        <Image source={{ uri: club.logo_url }} style={styles.logo} />
      ) : (
        <View style={styles.logoFallback}>
          <Text style={styles.logoInitials}>{getInitials(club.name)}</Text>
        </View>
      )}

      <Text style={styles.clubName}>{club.name}</Text>

      {club.location && (
        <View style={styles.locationRow}>
          <Ionicons name="location-outline" size={14} color="#64748b" />
          <Text style={styles.locationText}>{club.location}</Text>
        </View>
      )}

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Ionicons name="grid-outline" size={14} color="#64748b" />
          <Text style={styles.statText}>{courtCount} Courts</Text>
        </View>
        <Text style={styles.statDivider}>·</Text>
        <View style={styles.stat}>
          <Ionicons name="people-outline" size={14} color="#64748b" />
          <Text style={styles.statText}>{memberCount} Members</Text>
        </View>
      </View>

      {isMember ? (
        <View style={styles.memberBadge}>
          <Ionicons name="checkmark-circle" size={16} color="#16a34a" />
          <Text style={styles.memberText}>Member</Text>
        </View>
      ) : onJoin ? (
        <TouchableOpacity style={styles.joinButton} onPress={onJoin}>
          <Text style={styles.joinButtonText}>Join This Club</Text>
        </TouchableOpacity>
      ) : null}

      {(club.phone || club.website) && (
        <View style={styles.contactRow}>
          {club.phone && (
            <TouchableOpacity
              style={styles.contactItem}
              onPress={() => Linking.openURL(`tel:${club.phone}`)}
            >
              <Ionicons name="call-outline" size={16} color="#2563eb" />
              <Text style={styles.contactLink}>{club.phone}</Text>
            </TouchableOpacity>
          )}
          {club.website && (
            <TouchableOpacity
              style={styles.contactItem}
              onPress={() => Linking.openURL(club.website)}
            >
              <Ionicons name="globe-outline" size={16} color="#2563eb" />
              <Text style={styles.contactLink} numberOfLines={1}>
                {club.website.replace(/^https?:\/\//, '')}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {club.description && (
        <Text style={styles.description}>{club.description}</Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', paddingHorizontal: 20, paddingBottom: 20 },
  logo: { width: 88, height: 88, borderRadius: 44, marginBottom: 12 },
  logoFallback: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  logoInitials: { fontSize: 28, fontWeight: '700', color: '#64748b' },
  clubName: { fontSize: 24, fontWeight: '800', color: '#1e293b', textAlign: 'center', marginBottom: 4 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 12 },
  locationText: { fontSize: 14, color: '#64748b' },
  statsRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statText: { fontSize: 14, fontWeight: '600', color: '#475569' },
  statDivider: { color: '#cbd5e1', fontSize: 14 },
  joinButton: {
    backgroundColor: '#2563eb', borderRadius: 12, paddingHorizontal: 32, paddingVertical: 12, marginBottom: 16,
  },
  joinButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
  memberBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#f0fdf4', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, marginBottom: 16,
  },
  memberText: { fontSize: 14, fontWeight: '600', color: '#16a34a' },
  contactRow: { flexDirection: 'row', gap: 20, marginBottom: 12 },
  contactItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  contactLink: { fontSize: 14, color: '#2563eb', fontWeight: '500' },
  description: { fontSize: 14, color: '#64748b', lineHeight: 20, textAlign: 'center' },
})
