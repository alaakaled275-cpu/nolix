# ConvertAI – Store Integration Guide

Paste **one line of JavaScript** into your store and ConvertAI starts working immediately.

---

## Shopify

**Option A — Theme Editor (Recommended)**

1. Go to **Online Store → Themes → Edit Code**
2. Open `theme.liquid`
3. Paste before `</body>`:

```html
<script
  src="https://yourapp.com/popup.js"
  data-key="YOUR_EMBED_KEY"
  defer>
</script>
```

**Option B — Shopify Custom HTML Block**

Add a Custom HTML block to any page and paste the script tag.

---

## WooCommerce (WordPress)

**Option A — Plugin (Easy)**

Use the "Insert Headers and Footers" plugin and paste the script into the **Footer** section.

**Option B — functions.php**

```php
function convertai_popup_script() {
  echo '<script src="https://yourapp.com/popup.js" data-key="YOUR_EMBED_KEY" defer></script>';
}
add_action('wp_footer', 'convertai_popup_script');
```

**Cart Status Detection**

To let ConvertAI detect added-to-cart state automatically:

```php
// In your add-to-cart AJAX handler:
wc_enqueue_js("sessionStorage.setItem('convertai_cart_added', '1');");
```

---

## Etsy

Etsy does not allow custom JavaScript on shop pages.  
**Option:** Set up a custom landing page (Linktree, Carrd, etc.) that embeds ConvertAI and links your Etsy products.

---

## Any HTML Site

Paste before `</body>`:

```html
<script src="https://yourapp.com/popup.js" data-key="YOUR_EMBED_KEY" defer></script>
```

---

## Passing Cart State Manually

If your cart uses custom logic, signal ConvertAI manually:

```javascript
// When a product is added to cart:
sessionStorage.setItem('convertai_cart_added', '1');

// When checkout begins:
sessionStorage.setItem('convertai_checkout', '1');
```

---

## Finding Your Embed Key

1. Go to your ConvertAI Dashboard
2. Navigate to **Settings → Stores**
3. Copy the **Embed Key** for your store

---

## API Reference

| Endpoint | Method | Description |
|---|---|---|
| `/api/convert/analyze` | POST | Analyze a session, get offer decision |
| `/api/convert/convert` | POST | Mark session as converted (CTA clicked) |
| `/api/convert/sessions` | GET | List sessions (`?limit=50&format=csv`) |
| `/api/convert/stats` | GET | Aggregated analytics |

### Analyze Request Body

```json
{
  "session_id": "optional-unique-id",
  "time_on_site": 120,
  "pages_viewed": 4,
  "traffic_source": "paid_ads",
  "cart_status": "added",
  "device": "desktop"
}
```

### Analyze Response

```json
{
  "session_id": "sess_...",
  "ab_variant": "A",
  "intent_score": 71,
  "intent_level": "high",
  "show_popup": true,
  "offer_type": "discount_10",
  "headline": "Your 10% Off Is Waiting",
  "sub_message": "You've found the perfect item. Use code TAKE10 before it expires.",
  "cta_text": "Apply 10% Off Now",
  "urgency_line": "⌛ Offer expires in 15 minutes",
  "reasoning": "High intent visitor from paid ads with item in cart..."
}
```

---

## Privacy & GDPR

- ConvertAI only reads `sessionStorage` (cleared automatically when the browser closes)
- No cookies are set
- No personally identifiable information is collected
- Session IDs are random and not linked to real identities
