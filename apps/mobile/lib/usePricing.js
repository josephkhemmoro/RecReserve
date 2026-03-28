import { useMembershipStore } from '../store/membershipStore'

/**
 * Computes a price breakdown based on the court rate, booking duration, and player's tier.
 *
 * @param {number} hourlyRate - The court's hourly rate in dollars
 * @param {number} durationMinutes - Booking duration in minutes
 * @returns {{ base_price: number, discount_amount: number, final_price: number, is_free: boolean }}
 */
export function usePricing(hourlyRate, durationMinutes) {
  const tier = useMembershipStore((s) => s.tier)

  const basePrice = Math.round(((hourlyRate * durationMinutes) / 60) * 100) / 100

  if (tier?.can_book_free) {
    return {
      base_price: basePrice,
      discount_amount: basePrice,
      final_price: 0,
      is_free: true,
    }
  }

  const discountPercent = tier?.discount_percent ?? 0
  const discountAmount = Math.round(basePrice * (discountPercent / 100) * 100) / 100
  const finalPrice = Math.round((basePrice - discountAmount) * 100) / 100

  return {
    base_price: basePrice,
    discount_amount: discountAmount,
    final_price: finalPrice,
    is_free: false,
  }
}
