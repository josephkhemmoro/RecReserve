import { useState } from 'react'
import { View, Text, Image, ScrollView, TouchableOpacity, Modal, StyleSheet } from 'react-native'
import { colors, textStyles, spacing, borderRadius } from '../../theme'
import { SectionHeader, Icon } from '../ui'

export function ClubPhotoGallery({ photos }) {
  const [selectedPhoto, setSelectedPhoto] = useState(null)

  if (!photos || photos.length === 0) return null

  return (
    <View style={styles.container}>
      <View style={{ paddingHorizontal: spacing.lg }}><SectionHeader title="Photos" icon="camera-outline" /></View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {photos.map((photo) => (
          <TouchableOpacity key={photo.id} onPress={() => setSelectedPhoto(photo)} activeOpacity={0.8}>
            <Image source={{ uri: photo.photo_url }} style={styles.photo} />
            {photo.caption && <Text style={styles.caption} numberOfLines={1}>{photo.caption}</Text>}
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Modal visible={!!selectedPhoto} animationType="fade" transparent>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setSelectedPhoto(null)}>
          <TouchableOpacity style={styles.closeBtn} onPress={() => setSelectedPhoto(null)}>
            <Icon name="close" size="lg" color={colors.white} />
          </TouchableOpacity>
          {selectedPhoto && <Image source={{ uri: selectedPhoto.photo_url }} style={styles.fullImage} resizeMode="contain" />}
        </TouchableOpacity>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { marginBottom: spacing.lg },
  scroll: { paddingHorizontal: spacing.lg, gap: spacing.md },
  photo: { width: 240, height: 160, borderRadius: borderRadius.lg, backgroundColor: colors.neutral100 },
  caption: { ...textStyles.caption, color: colors.neutral500, marginTop: spacing.xs, maxWidth: 240 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' },
  closeBtn: { position: 'absolute', top: 60, right: spacing.lg, zIndex: 10 },
  fullImage: { width: '90%', height: '70%' },
})
