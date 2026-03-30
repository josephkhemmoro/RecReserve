import { useState } from 'react'
import { View, Text, Image, ScrollView, TouchableOpacity, Modal, StyleSheet } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'

export function ClubPhotoGallery({ photos }) {
  const [selectedPhoto, setSelectedPhoto] = useState(null)

  if (!photos || photos.length === 0) return null

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="camera-outline" size={18} color="#1e293b" />
        <Text style={styles.title}>Photos</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {photos.map((photo) => (
          <TouchableOpacity
            key={photo.id}
            onPress={() => setSelectedPhoto(photo)}
            activeOpacity={0.8}
          >
            <Image source={{ uri: photo.photo_url }} style={styles.photo} />
            {photo.caption && (
              <Text style={styles.caption} numberOfLines={1}>{photo.caption}</Text>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Modal visible={!!selectedPhoto} animationType="fade" transparent>
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setSelectedPhoto(null)}
        >
          <TouchableOpacity style={styles.closeBtn} onPress={() => setSelectedPhoto(null)}>
            <Ionicons name="close" size={28} color="#ffffff" />
          </TouchableOpacity>
          {selectedPhoto && (
            <Image
              source={{ uri: selectedPhoto.photo_url }}
              style={styles.fullImage}
              resizeMode="contain"
            />
          )}
        </TouchableOpacity>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { marginBottom: 20 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, marginBottom: 12 },
  title: { fontSize: 16, fontWeight: '700', color: '#1e293b' },
  scroll: { paddingHorizontal: 20, gap: 12 },
  photo: { width: 240, height: 160, borderRadius: 12, backgroundColor: '#f1f5f9' },
  caption: { fontSize: 12, color: '#64748b', marginTop: 4, maxWidth: 240 },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center',
  },
  closeBtn: { position: 'absolute', top: 60, right: 20, zIndex: 10 },
  fullImage: { width: '90%', height: '70%' },
})
