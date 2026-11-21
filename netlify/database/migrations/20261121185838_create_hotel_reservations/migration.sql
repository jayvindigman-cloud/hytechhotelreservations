CREATE TABLE "hotel_extras" (
	"id" serial PRIMARY KEY,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"price" numeric(10,2) NOT NULL,
	"unit" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "menu_items" (
	"id" serial PRIMARY KEY,
	"title" text NOT NULL UNIQUE,
	"category" text NOT NULL,
	"price" numeric(10,2) NOT NULL,
	"image" text,
	"description" text DEFAULT '' NOT NULL,
	"availability" text DEFAULT 'available' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "food_orders" (
	"id" serial PRIMARY KEY,
	"order_code" text NOT NULL UNIQUE,
	"account_id" text NOT NULL,
	"guest_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"room_number" text,
	"items" jsonb NOT NULL,
	"total_amount" numeric(10,2) NOT NULL,
	"notes" text,
	"status" text DEFAULT 'Pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"served_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "guest_directory_profiles" (
	"uid" text PRIMARY KEY,
	"email" text NOT NULL UNIQUE,
	"name" text NOT NULL,
	"photo_url" text
);
--> statement-breakpoint
CREATE TABLE "reservations" (
	"id" serial PRIMARY KEY,
	"reservation_code" text NOT NULL UNIQUE,
	"account_id" text NOT NULL,
	"request_key" text NOT NULL,
	"room_type_id" integer NOT NULL,
	"guest_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"check_in" date NOT NULL,
	"check_out" date NOT NULL,
	"actual_check_out" date,
	"guests" integer NOT NULL,
	"guest_names" jsonb DEFAULT '[]' NOT NULL,
	"nights" integer NOT NULL,
	"total_amount" numeric(10,2) NOT NULL,
	"payment_method" text NOT NULL,
	"payment_reference" text,
	"payment_status" text DEFAULT 'Unpaid' NOT NULL,
	"status" text DEFAULT 'Pending' NOT NULL,
	"room_number" text,
	"voucher_code" text,
	"discount_amount" numeric(10,2) DEFAULT '0' NOT NULL,
	"extras_snapshot" jsonb DEFAULT '[]' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reservation_dates_valid" CHECK ("check_out" > "check_in")
);
--> statement-breakpoint
CREATE TABLE "stay_reviews" (
	"reservation_id" integer PRIMARY KEY,
	"uid" text NOT NULL,
	"name" text NOT NULL,
	"hotel_rating" integer NOT NULL,
	"service_rating" integer NOT NULL,
	"comment" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "room_types" (
	"id" serial PRIMARY KEY,
	"slug" text NOT NULL UNIQUE,
	"name" text NOT NULL UNIQUE,
	"category" text NOT NULL,
	"price" numeric(10,2) NOT NULL,
	"capacity" integer NOT NULL,
	"total_units" integer DEFAULT 1 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"image" text,
	"bed" text,
	"description" text,
	CONSTRAINT "room_price_positive" CHECK ("price" >= 0),
	CONSTRAINT "room_capacity_positive" CHECK ("capacity" > 0),
	CONSTRAINT "room_inventory_nonnegative" CHECK ("total_units" >= 0)
);
--> statement-breakpoint
CREATE TABLE "vouchers" (
	"id" serial PRIMARY KEY,
	"code" text NOT NULL UNIQUE,
	"discount_type" text NOT NULL,
	"discount_value" numeric(10,2) NOT NULL,
	"valid_until" date,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE INDEX "reservation_availability" ON "reservations" ("room_type_id","check_in","check_out");--> statement-breakpoint
CREATE INDEX "reservation_account" ON "reservations" ("account_id","request_key");--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_room_type_id_room_types_id_fkey" FOREIGN KEY ("room_type_id") REFERENCES "room_types"("id");--> statement-breakpoint
ALTER TABLE "stay_reviews" ADD CONSTRAINT "stay_reviews_reservation_id_reservations_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON DELETE CASCADE;