import type { UserProfile } from '@vibetrip/shared/types/userProfile'

/**
 * ----------------------------------------
 * Types
 * ----------------------------------------
 */

export type UserProfileField = keyof UserProfile

export type UserProfileErrors = Partial<Record<UserProfileField, string>>

/**
 * ----------------------------------------
 * Screen Configuration
 * ----------------------------------------
 */

const screenRequiredFields: Record<number, UserProfileField[]> = {
  1: ['vibe', 'group', 'firstVisit'],
  2: ['city', 'arrivalDate', 'departureDate', 'arrivalTime', 'departureTime'],
  3: ['budget', 'pace'],
  4: [],
}

/**
 * ----------------------------------------
 * Primitive Helpers
 * ----------------------------------------
 */

const isBlank = (value?: string | null) => !value?.trim()

const isValidTime = (value: string) =>
  /^([01]\d|2[0-3]):([0-5]\d)$/.test(value)

const parseDate = (value: string | null): Date | null => {
  if (!value) return null

  const parsedDate = new Date(value)

  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate
}

/**
 * ----------------------------------------
 * Reusable Validators
 * ----------------------------------------
 */

const validateRequiredSelection = <T>(
  value: T | null,
  message: string
) => (value === null ? message : null)

const validateRequiredText = (
  value: string | null,
  message: string
) => (isBlank(value) ? message : null)

const validateRequiredTime = (
  value: string | null,
  label: string
) => {
  if (isBlank(value)) {
    return `${label} is required`
  }

  return isValidTime(value!)
    ? null
    : `${label} must be in HH:MM format`
}

const validateBudget = (value: number | null) => {
  if (value === null) {
    return 'Enter a budget'
  }

  if (!Number.isFinite(value) || value <= 0) {
    return 'Budget must be greater than 0'
  }

  return null
}

const validateDepartureDate = (
  arrivalDate: string | null,
  departureDate: string | null
) => {
  const startDate = parseDate(arrivalDate)
  const endDate = parseDate(departureDate)

  if (!endDate) {
    return 'Enter a valid departure date'
  }

  if (startDate && endDate < startDate) {
    return 'Departure must be after arrival'
  }

  return null
}

/**
 * ----------------------------------------
 * Field-Level Validation
 * ----------------------------------------
 */

export function validateField(
  field: UserProfileField,
  profile: UserProfile
): string | null {
  switch (field) {
    case 'vibe':
      return profile.vibe.length > 0
        ? null
        : 'Select at least one vibe'

    case 'firstVisit':
      return validateRequiredSelection(
        profile.firstVisit,
        'Select if this is your first visit'
      )

    case 'group':
      return validateRequiredSelection(
        profile.group,
        'Select your group type'
      )

    case 'city':
      return validateRequiredText(profile.city, 'Enter a city')

    case 'arrivalDate':
      if (isBlank(profile.arrivalDate)) {
        return 'Enter an arrival date'
      }

      return parseDate(profile.arrivalDate)
        ? null
        : 'Enter a valid arrival date'

    case 'departureDate':
      if (isBlank(profile.departureDate)) {
        return 'Enter a departure date'
      }

      return validateDepartureDate(
        profile.arrivalDate,
        profile.departureDate
      )

    case 'arrivalTime':
      return validateRequiredTime(
        profile.arrivalTime,
        'Arrival time'
      )

    case 'departureTime':
      return validateRequiredTime(
        profile.departureTime,
        'Departure time'
      )

    case 'budget':
      return validateBudget(profile.budget)

    case 'pace':
      return validateRequiredSelection(profile.pace, 'Select a pace')

    /**
     * Screen 4 fields are optional in the current flow.
     * They can still be validated later if your form rules change.
     */
    case 'hotelArea':
    case 'currency':
    case 'budgetSplit':
    case 'wakeUpStyle':
    case 'transportPreference':
    case 'dietary':
    case 'mobilityNeeds':
    case 'ageGroup':
    case 'mustVisit':
    case 'avoid':
      return null

    default:
      return null
  }
}

/**
 * ----------------------------------------
 * Full Form Validation
 * ----------------------------------------
 */

export function validateUserProfile(
  profile: UserProfile
): UserProfileErrors {
  const errors: UserProfileErrors = {}

  for (const field of Object.keys(profile) as UserProfileField[]) {
    const error = validateField(field, profile)

    if (error) {
      errors[field] = error
    }
  }

  return errors
}

export function isUserProfileValid(profile: UserProfile) {
  return Object.keys(validateUserProfile(profile)).length === 0
}

/**
 * ----------------------------------------
 * Screen-Level Validation
 * ----------------------------------------
 */

export function validateScreen(
  screenNumber: number,
  userProfile: UserProfile
): boolean {
  const requiredFields = screenRequiredFields[screenNumber]

  if (!requiredFields) {
    return false
  }

  return requiredFields.every(field => !validateField(field, userProfile))
}

/**
 * ----------------------------------------
 * Error Helpers
 * ----------------------------------------
 */

export function hasFieldError(
  errors: UserProfileErrors,
  field: UserProfileField
) {
  return !!errors[field]
}
