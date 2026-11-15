/**
 * Tipos de la base de datos para el cliente de Supabase.
 * Escritos a mano a partir de supabase/migrations/. Si cambias el esquema,
 * actualiza también este archivo (más adelante se pueden generar con
 * `supabase gen types typescript`).
 */
import type { Alergeno } from "@/lib/domain/alergenos";
import type { Idioma } from "@/lib/domain/idiomas";

type Variante = { label: string; price_cents: number };

type Tabla<Fila, Insertar, Actualizar = Partial<Insertar>> = {
  Row: Fila;
  Insert: Insertar;
  Update: Actualizar;
  Relationships: [];
};

export type FilaRestaurante = {
  id: string;
  slug: string;
  name: string;
  base_language: Idioma;
  languages: Idioma[];
  logo_path: string | null;
  brand_color: string | null;
  is_published: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type FilaMiembro = {
  restaurant_id: string;
  user_id: string;
  role: "owner" | "staff";
  created_at: string;
};

export type FilaCategoria = {
  id: string;
  restaurant_id: string;
  name: string;
  position: number;
  created_at: string;
  updated_at: string;
};

export type FilaPlato = {
  id: string;
  restaurant_id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  price_cents: number;
  variants: Variante[];
  photo_path: string | null;
  is_available: boolean;
  is_new: boolean;
  position: number;
  allergens_reviewed_at: string | null;
  allergens_reviewed_by: string | null;
  created_at: string;
  updated_at: string;
};

export type FilaAlergenoPlato = {
  restaurant_id: string;
  dish_id: string;
  allergen: Alergeno;
  status: "suggested" | "confirmed";
  source: "ai" | "manual";
  confirmed_by: string | null;
  confirmed_at: string | null;
  created_at: string;
};

export type Database = {
  public: {
    Tables: {
      restaurants: Tabla<
        FilaRestaurante,
        {
          slug: string;
          name: string;
          base_language?: Idioma;
          languages?: Idioma[];
          logo_path?: string | null;
          brand_color?: string | null;
          is_published?: boolean;
        }
      >;
      members: Tabla<
        FilaMiembro,
        { restaurant_id: string; user_id: string; role?: "owner" | "staff" }
      >;
      categories: Tabla<
        FilaCategoria,
        { restaurant_id: string; name: string; position?: number }
      >;
      dishes: Tabla<
        FilaPlato,
        {
          restaurant_id: string;
          category_id?: string | null;
          name: string;
          description?: string | null;
          price_cents: number;
          variants?: Variante[];
          is_available?: boolean;
          is_new?: boolean;
          position?: number;
        }
      >;
      dish_allergens: Tabla<
        FilaAlergenoPlato,
        { restaurant_id: string; dish_id: string; allergen: Alergeno; status?: "suggested"; source?: "ai" | "manual" }
      >;
    };
    Views: Record<string, never>;
    Functions: {
      guardar_alergenos: {
        Args: { p_plato: string; p_alergenos: Alergeno[] };
        Returns: undefined;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
