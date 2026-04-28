# TAR Use Cases — 4 Tables, Every Domain

Pattern: `state` = what it is, `instance` = where/how much/price, `events` = what happened, `stateai` = vector search

---

## Commerce

| Use Case | Example |
|---|---|
| Product catalog | state: "Chettinad Chicken Biryani", instance: store=Adyar, qty=50, ₹180 |
| Inventory tracking | instance.qty decrements on each sale, event: SOLD delta=-1 |
| Multi-store pricing | Same state.ucode, two instances: Adyar ₹180, T.Nagar ₹200 |
| Flash sale / time window | instance.startts=6pm, endts=9pm, value=₹99 |
| Variant management | state payload: {sizes:["S","M","L"], colors:["Red","Blue"]} |
| Cart | event stream: CART_ADD, CART_REMOVE, CHECKOUT per user |
| Order lifecycle | event stream: ORDER_PLACED → CONFIRMED → PREPARING → READY → DELIVERED |
| Invoice / billing | event: INVOICE_GENERATED payload={items, tax, total} |
| Refund / return | event: REFUND delta=-₹180, linked to original order streamid |
| Subscription / recurring | instance with endts=renewal date, event: RENEWAL_DUE |
| Coupon / discount | state type=coupon, instance.qty=usage limit, event: COUPON_APPLIED |
| Wishlist | event: WISHLISTED per user, streamid=user |
| Bundle / combo | state type=bundle, payload={child_ucodes:["biryani","raita","coke"]} |

---

## POS / In-Store

| Use Case | Example |
|---|---|
| Cash register sale | event: POS_SALE opcode=SALE, delta=₹540, scope=store |
| Shift management | event stream: SHIFT_START → BREAK → SHIFT_END per staff |
| Daily cash close | event: CASH_CLOSE payload={expected:₹45000, actual:₹44800} |
| Table management | state type=table, instance: scope=restaurant, available=1/0 |
| KDS (kitchen display) | event: ORDER_FIRE → ITEM_READY per order item |
| Queue / token system | event stream: TOKEN_ISSUED → TOKEN_CALLED → TOKEN_SERVED |

---

## CRM / Customers

| Use Case | Example |
|---|---|
| Customer profile | state type=customer, payload={name, phone, segment} |
| Loyalty points | instance: stateid=customer, value=1200 (points balance) |
| Visit tracking | event: STORE_VISIT per customer per store |
| Feedback / review | event: REVIEW payload={rating:4, text:"great biryani"} |
| Customer segment | state type=segment, payload={rules:"spent>5000 last 30d"} |
| Lead / prospect | state type=lead, event stream: LEAD_CREATED → CONTACTED → CONVERTED |
| Support ticket | event stream: TICKET_OPEN → REPLY → RESOLVED |
| Birthday / anniversary offers | state payload={dob:"1990-05-15"}, event: BIRTHDAY_OFFER_SENT |

---

## Sites / Storefronts

| Use Case | Example |
|---|---|
| Store page | state type=store, payload={name, logo, banner, theme, hours} |
| Section / category | state type=section, payload={title:"Lunch Menu", display_order:1} |
| Page / landing page | state type=page, payload={html, slug:"/about-us"} |
| Banner / hero | state type=banner, payload={image_url, link, position} |
| Menu / navigation | state type=menu, payload={items:[{label, href}]} |
| SEO metadata | state payload includes {meta_title, meta_desc, og_image} |
| Multi-store chain | Multiple store states, instances link products to each |
| Store hours | state payload={hours:{mon:"9-21", tue:"9-21"}} |

---

## Logistics / Delivery

| Use Case | Example |
|---|---|
| Delivery tracking | event stream: DISPATCHED → IN_TRANSIT(lat,lng) → DELIVERED |
| Driver assignment | event: DRIVER_ASSIGNED payload={driver_id, vehicle} |
| Route / ETA | event: ETA_UPDATED payload={eta_mins:12} |
| Warehouse / hub | state type=warehouse, instances=stock per SKU at that hub |
| Transfer between stores | event: TRANSFER_OUT(store A) + TRANSFER_IN(store B), delta=±qty |
| Return pickup | event stream: RETURN_REQUESTED → PICKUP_SCHEDULED → PICKED_UP |
| Last-mile status | event: DELIVERY_ATTEMPT payload={result:"customer_unavailable"} |

---

## Staff / HR

| Use Case | Example |
|---|---|
| Employee record | state type=employee, payload={role, phone, joined} |
| Attendance | event: CLOCK_IN lat/lng, CLOCK_OUT per day |
| Payroll entry | event: PAYROLL delta=₹25000, scope=store |
| Task assignment | event: TASK_ASSIGNED payload={task, assignee, due} |
| Performance note | event: PERFORMANCE_NOTE payload={note, rating} |
| Leave request | event stream: LEAVE_REQUESTED → APPROVED/REJECTED |

---

## Marketing / Campaigns

| Use Case | Example |
|---|---|
| Campaign | state type=campaign, payload={message, audience, channel} |
| Push notification | event: PUSH_SENT scope=campaign, per user |
| SMS blast | event: SMS_SENT payload={phone, template} |
| A/B test variant | state type=ab_variant, instances: variant_a vs variant_b |
| Referral tracking | event: REFERRAL payload={referrer, referee, reward} |
| Promo code | state type=promo, instance.qty=remaining uses |

---

## Analytics / Reporting

| Use Case | Example |
|---|---|
| Sales dashboard | SUM(events.delta) WHERE opcode=SALE GROUP BY scope, day |
| Top products | COUNT events WHERE opcode=SOLD GROUP BY stateid |
| Peak hours | COUNT events GROUP BY HOUR(ts) |
| Customer LTV | SUM(events.delta) WHERE streamid=customer_id |
| Conversion funnel | COUNT events per opcode: VIEW → CART → CHECKOUT → PAID |
| Geo heatmap | events grouped by lat/lng or instance.h3 |

---

## Scheduling / Bookings

| Use Case | Example |
|---|---|
| Appointment slot | instance: scope=salon, startts=10:00, endts=10:30, available=1 |
| Booking | event: BOOKED → CONFIRMED → COMPLETED per appointment |
| Class / event registration | state type=class, instance.qty=seats remaining |
| Recurring schedule | multiple instances same stateid, different startts/endts |
| Cancellation | event: CANCELLED, instance.available=1 restored |

---

## Payments

| Use Case | Example |
|---|---|
| UPI payment | event: PAYMENT_INITIATED → PAYMENT_SUCCESS delta=₹540 |
| Partial payment | event: PARTIAL_PAYMENT delta=₹200, remaining in payload |
| Split bill | multiple PAYMENT events on same order streamid |
| Payout to seller | event: PAYOUT delta=₹4800, scope=store |
| Payment failure | event: PAYMENT_FAILED payload={reason:"timeout"} |

---

## Services (Non-Product)

| Use Case | Example |
|---|---|
| Plumber listing | state type=service, title="Pipe repair", instance: scope=plumber, value=₹500, h3=Adyar |
| Tutor booking | state type=tutor, instance: available=1, startts/endts slots |
| Cab / auto ride | event stream: RIDE_REQUESTED → DRIVER_MATCHED → IN_RIDE → COMPLETED |
| Tiffin service | state type=meal_plan, instance: qty=30(days), value=₹3000/mo |
| Home cleaning | state type=service, event: BOOKING → ASSIGNED → COMPLETED |

---

**Total: 70+ use cases across 12 domains** — all on `state`, `instance`, `events`, `stateai`.
