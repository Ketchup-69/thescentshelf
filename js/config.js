// The Scent Shelf: site settings. This is the only file you need to edit for
// the waitlist, prices, delivery and the priority deposit. See README.md.

// 1) WAITLIST
// The Google Apps Script web app URL (ends in /exec). Checkout also sends here.
export const WAITLIST_ENDPOINT = 'https://script.google.com/macros/s/AKfycbxEpu1hzIgxYl9XZQ3qqhVnqSAXemAHthQggbzrXSU7761gM_Ey8JgMAx9LJLrJQTX1/exec';

// 2) PRICES
// Rupees per US dollar, used to show USD next to every INR price. Update it now and then.
export const USD_INR_RATE = 88;

// 3) BAG AND CHECKOUT (preview only: no payment is taken)
// Standard delivery charge per order, in rupees. [TO CONFIRM]
export const DELIVERY_FEE_INR = 149;
// Buy this many and the next one is free (the cheapest in the bag), with free delivery.
export const BUY_X_GET_ONE = 5;
// Optional add-on at checkout: hand-delivered by the founder.
export const FOUNDER_DELIVERY_USD = 4000;

// 4) PRIORITY DEPOSIT (keep OFF until the business is registered and Razorpay KYC is approved)
export const PRIORITY_DEPOSIT_ENABLED = false;
export const RAZORPAY_PAYMENT_LINK = '';
export const DEPOSIT_AMOUNT_INR = 100;
export const DEPOSIT_REFUND_DAYS = 60;
