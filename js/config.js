// The Scent Shelf: site settings. This is the only file you need to edit for
// the waitlist and the priority deposit. See README.md for step-by-step help.

// 1) WAITLIST
// Paste the Google Apps Script web app URL here (it ends in /exec).
// While this is empty, the live site tells visitors the waitlist is not open yet
// and saves nothing.
export const WAITLIST_ENDPOINT = '';

// 2) PRIORITY DEPOSIT (keep OFF until the business is registered and Razorpay KYC is approved)
export const PRIORITY_DEPOSIT_ENABLED = false;

// Razorpay Payment Link or Payment Page URL, e.g. 'https://rzp.io/l/xxxxxxx'.
// The deposit offer only shows when the flag above is true AND this link is set.
export const RAZORPAY_PAYMENT_LINK = '';

export const DEPOSIT_AMOUNT_INR = 100;

// Deposits are refunded automatically if the product has not launched within this many days.
export const DEPOSIT_REFUND_DAYS = 60;
