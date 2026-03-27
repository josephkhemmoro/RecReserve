import { useEffect, useRef, useState } from 'react'
import { Animated, Text, StyleSheet } from 'react-native'

export function NetworkToast({ visible, message = 'No internet connection — please check your network' }) {
  const translateY = useRef(new Animated.Value(-100)).current
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (visible) {
      setShow(true)
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 80,
        friction: 12,
      }).start()

      const timer = setTimeout(() => {
        Animated.timing(translateY, {
          toValue: -100,
          duration: 300,
          useNativeDriver: true,
        }).start(() => setShow(false))
      }, 4000)

      return () => clearTimeout(timer)
    }
  }, [visible])

  if (!show) return null

  return (
    <Animated.View style={[styles.container, { transform: [{ translateY }] }]}>
      <Text style={styles.text}>{message}</Text>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 14,
    zIndex: 9999,
  },
  text: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
})
