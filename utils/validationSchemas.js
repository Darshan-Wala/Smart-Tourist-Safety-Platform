import * as yup from 'yup';

export const loginSchema = yup.object({
  email: yup.string().email('Invalid email').required('Email required'),
  password: yup.string().min(6, 'Min 6 chars').required('Password required')
});

export const registerSchema = yup.object({
  fullName: yup.string().min(2).required('Full name required'),
  email: yup.string().email('Invalid email').required('Email required'),
  password: yup.string().min(6).required('Password required'),
  confirmPassword: yup
    .string()
    .oneOf([yup.ref('password')], 'Passwords must match')
    .required('Confirm password'),
  phoneNumber: yup.string().required('Phone required'),
  nationality: yup.string().required('Nationality required'),
  passportNumber: yup.string().nullable(),
  emergencyContact: yup.string().nullable(),
  emergencyPhone: yup.string().nullable()
});