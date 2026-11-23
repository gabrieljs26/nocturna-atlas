create table public.nocturna_objects (
  id text primary key check (id ~ '^m[1-9][0-9]{0,2}$'),
  title text not null,
  category text not null check (category in ('galaxia', 'nebulosa', 'cumulo')),
  object_type text not null,
  constellation text not null,
  season text not null check (season in ('Primavera', 'Verano', 'Otoño', 'Invierno')),
  instrument text not null,
  magnitude numeric(3, 1) not null,
  right_ascension text not null,
  declination text not null,
  distance text not null,
  summary text not null,
  description text not null,
  observation_tip text not null,
  image_path text not null check (image_path ~ '^/images/[a-z-]+[.]webp$'),
  image_alt text not null,
  display_order smallint not null unique check (display_order > 0)
);

create table public.nocturna_observations (
  guest_id text not null check (guest_id ~ '^[a-f0-9]{64}$'),
  object_id text not null references public.nocturna_objects (id) on delete cascade,
  saved_at timestamptz not null default now(),
  primary key (guest_id, object_id)
);

create index nocturna_observations_object_idx on public.nocturna_observations (object_id);

alter table public.nocturna_objects enable row level security;
alter table public.nocturna_observations enable row level security;

do $$
begin
  if not exists (select from pg_roles where rolname = 'nocturna_app') then
    create role nocturna_app nologin;
  end if;
end
$$;

revoke all on table public.nocturna_objects, public.nocturna_observations from public, anon, authenticated, service_role;
grant usage on schema public to nocturna_app;
grant select on table public.nocturna_objects to nocturna_app;
grant select, insert, delete on table public.nocturna_observations to nocturna_app;

create policy catalog_read on public.nocturna_objects
  for select to nocturna_app using (true);

create policy observations_read on public.nocturna_observations
  for select to nocturna_app using (
    guest_id = nullif(current_setting('nocturna.guest_id', true), '')
  );

create policy observations_insert on public.nocturna_observations
  for insert to nocturna_app with check (
    guest_id = nullif(current_setting('nocturna.guest_id', true), '')
  );

create policy observations_delete on public.nocturna_observations
  for delete to nocturna_app using (
    guest_id = nullif(current_setting('nocturna.guest_id', true), '')
  );

insert into public.nocturna_objects (
  id, title, category, object_type, constellation, season, instrument, magnitude,
  right_ascension, declination, distance, summary, description, observation_tip,
  image_path, image_alt, display_order
) values
(
  'm31', 'Galaxia de Andrómeda', 'galaxia', 'Galaxia espiral', 'Andrómeda', 'Otoño',
  'Prismáticos', 3.4, '00 h 42 m 44 s', '+41° 16′ 08″', '2,5 millones de años luz',
  'Nuestra gran vecina galáctica, visible como una tenue mancha alargada bajo un cielo oscuro.',
  'Andrómeda es la galaxia espiral grande más cercana a la Vía Láctea. Su núcleo brillante y su disco inclinado dibujan una silueta que ocupa varias veces el diámetro de la Luna llena en el cielo.',
  'Localiza Mirach y barre con prismáticos hacia el noroeste. Usa poco aumento y aparta la vista ligeramente del núcleo para percibir su halo.',
  '/images/andromeda.webp', 'Disco inclinado y brillante de la galaxia de Andrómeda', 1
),
(
  'm42', 'Nebulosa de Orión', 'nebulosa', 'Nebulosa de emisión', 'Orión', 'Invierno',
  'Prismáticos', 4.0, '05 h 35 m 17 s', '−05° 23′ 28″', '1.500 años luz',
  'Gas brillante y estrellas jóvenes en la espada de la constelación más fácil de reconocer en invierno.',
  'En el corazón de Orión, la radiación de estrellas jóvenes ilumina una nube de gas y polvo donde se están formando nuevos sistemas estelares.',
  'Encuentra las tres estrellas del cinturón y baja hacia la espada. A pocos aumentos, la nebulosa rodea el pequeño grupo estelar del Trapecio.',
  '/images/orion.webp', 'Nubes luminosas de gas y polvo en la nebulosa de Orión', 2
),
(
  'm45', 'Las Pléyades', 'cumulo', 'Cúmulo abierto', 'Tauro', 'Invierno',
  'A simple vista', 1.6, '03 h 47 m 00 s', '+24° 07′ 00″', '440 años luz',
  'Un grupo compacto de estrellas azules que se distingue a simple vista en Tauro.',
  'Las Siete Hermanas son un cúmulo de estrellas jóvenes, calientes y luminosas. El polvo que las rodea refleja su luz azul, visible con claridad en fotografías de larga exposición.',
  'Busca un pequeño grupo con forma de cucharón al noroeste de Aldebarán. Los prismáticos muestran muchas más estrellas y mantienen todo el cúmulo en el campo.',
  '/images/pleyades.webp', 'Estrellas azules de las Pléyades entre velos de polvo', 3
),
(
  'm13', 'Gran Cúmulo de Hércules', 'cumulo', 'Cúmulo globular', 'Hércules', 'Verano',
  'Telescopio', 5.8, '16 h 41 m 41 s', '+36° 27′ 36″', '25.000 años luz',
  'Cientos de miles de estrellas reunidas en una esfera que orbita la Vía Láctea.',
  'M13 es uno de los cúmulos globulares más conocidos del cielo boreal. En un telescopio, su brillo difuso se descompone en multitud de puntos alrededor de un núcleo muy denso.',
  'Busca el trapecio central de Hércules y recorre el lado entre Eta y Zeta. Aumenta la potencia una vez centrado el cúmulo para ver estrellas en la periferia.',
  '/images/hercules.webp', 'Concentración de estrellas del cúmulo globular de Hércules', 4
),
(
  'm51', 'Galaxia del Remolino', 'galaxia', 'Galaxia espiral', 'Canes Venatici', 'Primavera',
  'Telescopio', 8.4, '13 h 29 m 53 s', '+47° 11′ 43″', '31 millones de años luz',
  'Dos galaxias en interacción, con brazos espirales ricos en regiones de formación estelar.',
  'M51 se ve casi de frente. Su compañera NGC 5195 aparece junto al extremo de uno de sus brazos, donde la interacción gravitatoria ha alterado el patrón espiral.',
  'Parte de Alkaid, en el extremo del mango del Carro, y elige una noche sin Luna. En un telescopio pequeño, busca primero los dos núcleos antes de intentar distinguir los brazos.',
  '/images/remolino.webp', 'Brazos espirales de la galaxia del Remolino y su galaxia compañera', 5
),
(
  'm57', 'Nebulosa del Anillo', 'nebulosa', 'Nebulosa planetaria', 'Lira', 'Verano',
  'Telescopio', 8.8, '18 h 53 m 35 s', '+33° 01′ 45″', '2.000 años luz',
  'Una pequeña envoltura de gas expulsada por una estrella al final de su vida.',
  'La Nebulosa del Anillo parece un óvalo luminoso porque observamos de frente buena parte de su estructura. Una enana blanca en el centro ilumina el gas que dejó la estrella original.',
  'Apunta entre Beta y Gamma de Lira. Empieza con poco aumento y sube gradualmente para distinguir el hueco central cuando la atmósfera esté estable.',
  '/images/anillo.webp', 'Anillo ovalado de gas luminoso de la nebulosa M57', 6
);
