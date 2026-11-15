/**
 * DEMO DATA — clearly fictional.
 *
 * Every place, person, review and collection below is invented for demo mode.
 * Place names are fictional (set in real neighbourhoods so the map makes sense),
 * and ratings come only from these sample users. Nothing here is presented as a
 * real business review or a real community rating. The UI marks demo content
 * with a "Demo" badge.
 */
import type {
  AppNotification,
  Category,
  Collection,
  CollectionFollow,
  CollectionPlace,
  Database,
  Follow,
  Friendship,
  Place,
  PlaceRecommendation,
  Profile,
  Review,
  ReviewTag,
  SavedPlace,
} from "../types";

export const DEMO_ME_ID = "u-alex";

const DAY = 86_400_000;
const ago = (days: number, hours = 0) => new Date(Date.now() - days * DAY - hours * 3_600_000).toISOString();

const img = (id: string, w = 1200) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=75`;

const publicPrivacy = { profile: "public", saved: "friends", reviews: "public" } as const;

// ---------------------------------------------------------------- Profiles
const profiles: Profile[] = [
  {
    id: DEMO_ME_ID,
    username: "alex",
    fullName: "Alex de Vries",
    bio: "Chasing the perfect flat white and a good plate of pasta. Amsterdam-based.",
    location: "Amsterdam",
    createdAt: ago(320),
    privacy: { profile: "friends", saved: "friends", reviews: "friends" },
  },
  { id: "u-emma", username: "emma", fullName: "Emma Jansen", bio: "Filter coffee evangelist. Weekend baker. I rate harshly so you don't have to.", location: "Amsterdam", createdAt: ago(400), privacy: { ...publicPrivacy } },
  { id: "u-thomas", username: "thomas", fullName: "Thomas Bakker", bio: "Will cross the city for good pasta. Architect by day.", location: "Amsterdam", createdAt: ago(380), privacy: { ...publicPrivacy } },
  { id: "u-sarah", username: "sarah", fullName: "Sarah Cohen", bio: "Travel writer. Collecting tiny cafés in big cities.", location: "Lisbon & Amsterdam", createdAt: ago(360), privacy: { ...publicPrivacy } },
  { id: "u-lucas", username: "lucas", fullName: "Lucas Moreau", bio: "Paris natural-wine bars and the bistros next door.", location: "Paris", createdAt: ago(300), privacy: { ...publicPrivacy } },
  { id: "u-noor", username: "noor", fullName: "Noor Haddad", bio: "Brunch is a lifestyle. Spice tolerance: high.", location: "Amsterdam", createdAt: ago(250), privacy: { profile: "friends", saved: "friends", reviews: "friends" } },
  { id: "u-julia", username: "julia", fullName: "Julia Lindqvist", bio: "Copenhagen. Cardamom buns, harbour swims, long dinners.", location: "Copenhagen", createdAt: ago(280), privacy: { ...publicPrivacy } },
  { id: "u-ines", username: "ines", fullName: "Inês Costa", bio: "Lisbon local. I write the list I wish my visiting friends had.", location: "Lisbon", createdAt: ago(500), privacy: { profile: "public", saved: "public", reviews: "public" } },
  { id: "u-mateo", username: "mateo", fullName: "Mateo Ruiz", bio: "Cocktails and late-night snacks.", location: "Amsterdam", createdAt: ago(90), privacy: { ...publicPrivacy } },
  { id: "u-freya", username: "freya", fullName: "Freya Nielsen", bio: "Seafood, saunas, and sourdough.", location: "Copenhagen", createdAt: ago(200), privacy: { ...publicPrivacy } },
  { id: "u-daan", username: "daan", fullName: "Daan Visser", bio: "Bakery hunter. Up at 7, croissant by 7:15.", location: "Amsterdam", createdAt: ago(150), privacy: { ...publicPrivacy } },
];

// ---------------------------------------------------------------- Places
type P = [
  id: string,
  name: string,
  category: Category,
  cuisine: string | null,
  city: string,
  neighborhood: string,
  address: string,
  lat: number,
  lng: number,
  price: number,
  image: string,
  description: string,
  hours: string[],
];

const H_CAFE = ["Mon–Fri 07:30–17:00", "Sat–Sun 08:30–17:00"];
const H_DINNER = ["Tue–Sat 17:30–23:00", "Sun 17:00–22:00", "Mon closed"];
const H_BAR = ["Wed–Thu 17:00–01:00", "Fri–Sat 17:00–03:00", "Sun 16:00–00:00"];
const H_BAKERY = ["Tue–Sun 07:00–15:00", "Mon closed"];
const H_ALLDAY = ["Daily 09:00–22:00"];

const placeRows: P[] = [
  // Amsterdam
  ["p-lumen", "Lumen Koffie", "coffee", "Specialty coffee", "Amsterdam", "Jordaan", "Tweede Anjeliersdwarsstraat 14, Amsterdam", 52.3772, 4.8829, 1, "1495474472287-4d71bcdd2085", "A narrow, light-filled espresso bar roasting single-origin beans in small batches.", H_CAFE],
  ["p-fiume", "Osteria Fiume", "restaurant", "Italian", "Amsterdam", "De Pijp", "Gerard Doustraat 61, Amsterdam", 52.3548, 4.8921, 2, "1473093295043-cdd812d0e601", "Hand-rolled pasta, a short Piedmontese wine list and a kitchen that closes when the dough runs out.", H_DINNER],
  ["p-brood", "Brood & Boter", "bakery", "Bakery", "Amsterdam", "Oud-West", "Kinkerstraat 102, Amsterdam", 52.3652, 4.8698, 1, "1509440159596-0249088772ff", "Long-fermented sourdough, cardamom knots and a queue that moves fast.", H_BAKERY],
  ["p-sora", "Sora", "restaurant", "Japanese", "Amsterdam", "Oost", "Javaplein 9, Amsterdam", 52.3612, 4.9405, 4, "1579871494447-9811cf80d66c", "Ten seats around a hinoki counter. Seasonal omakase, booked two weeks out.", ["Wed–Sat 18:00 & 20:30 seatings"]],
  ["p-kanaal", "Het Kleine Kanaal", "restaurant", "Modern Dutch", "Amsterdam", "Grachtengordel", "Prinsengracht 412, Amsterdam", 52.3681, 4.8852, 3, "1414235077428-338989a2e8c0", "Candle-lit canal house serving North Sea fish and Dutch vegetables with real finesse.", H_DINNER],
  ["p-vlinder", "Nachtvlinder", "bar", "Cocktail bar", "Amsterdam", "Centrum", "Zeedijk 33, Amsterdam", 52.3748, 4.9002, 3, "1514933651103-005eec06c04b", "A moody, velvet-lined cocktail bar with a seasonal menu built on Dutch genever.", H_BAR],
  ["p-vers", "Vers", "cafe", "Brunch", "Amsterdam", "De Pijp", "Sarphatipark 6, Amsterdam", 52.3557, 4.8966, 2, "1567620905732-2d1ec7ab7445", "Sunny corner café for long brunches: ricotta pancakes, shakshuka, good oat flat whites.", ["Daily 08:30–16:00"]],
  ["p-fermento", "Fermento", "bar", "Natural wine", "Amsterdam", "Noord", "NDSM-plein 21, Amsterdam", 52.4013, 4.8925, 2, "1470337458703-46ad1756a187", "Industrial wine bar by the water with skin-contact pours and small plates.", H_BAR],
  ["p-tamarind", "Tamarind Tafel", "restaurant", "Indonesian", "Amsterdam", "Oost", "Dapperstraat 48, Amsterdam", 52.3631, 4.9281, 2, "1546069901-ba9599a7e63c", "Family-run rijsttafel with sambal made fresh each morning.", H_ALLDAY],
  ["p-roast", "Roast Collective", "coffee", "Specialty coffee", "Amsterdam", "Oost", "Linnaeusstraat 77, Amsterdam", 52.3605, 4.9265, 1, "1509042239860-f550ce710b93", "Roastery and tasting bar. Ask for the rotating filter flight.", H_CAFE],
  ["p-panelento", "Pane Lento", "bakery", "Italian bakery", "Amsterdam", "Jordaan", "Lindengracht 90, Amsterdam", 52.3800, 4.8821, 1, "1555507036-ab1f4038808a", "Focaccia, maritozzi and espresso standing at the counter like in Rome.", H_BAKERY],
  ["p-brasa", "Casa Brasa", "restaurant", "Spanish grill", "Amsterdam", "Oud-West", "Jan Pieter Heijestraat 140, Amsterdam", 52.3624, 4.8611, 3, "1600891964599-f61ba0e24092", "Wood-fired grill, Basque cider and a counter overlooking the flames.", H_DINNER],
  ["p-kade", "Kade Koffiebar", "coffee", "Specialty coffee", "Amsterdam", "Westerpark", "Haarlemmerweg 8, Amsterdam", 52.3861, 4.8752, 1, "1501339847302-ac426a4a7cbb", "Canal-side kiosk with a big terrace. Laptop-free, conversation-full.", H_CAFE],
  ["p-verde", "Verde Pasta Bar", "restaurant", "Italian", "Amsterdam", "Centrum", "Spuistraat 210, Amsterdam", 52.3709, 4.8901, 2, "1621996346565-e3dbc646d9a9", "Walk-in pasta counter. Cacio e pepe in under ten minutes.", H_ALLDAY],
  // Copenhagen
  ["p-havn", "Havn Bageri", "bakery", "Danish bakery", "Copenhagen", "Nørrebro", "Jægersborggade 41, Copenhagen", 55.6935, 12.5452, 1, "1509440159596-0249088772ff", "Cardamom buns that sell out by ten and rye bread worth the trip.", H_BAKERY],
  ["p-saltvand", "Saltvand", "restaurant", "Seafood", "Copenhagen", "Christianshavn", "Overgaden Neden Vandet 17, Copenhagen", 55.6727, 12.5918, 3, "1559339352-11d035aa65de", "Harbour-side seafood with a short, very Nordic tasting menu.", H_DINNER],
  ["p-kaffenord", "Kaffe Nord", "coffee", "Specialty coffee", "Copenhagen", "Vesterbro", "Istedgade 92, Copenhagen", 55.6693, 12.5532, 1, "1442512595331-e89e73853f31", "Light Nordic roasts and a window bench made for slow mornings.", H_CAFE],
  ["p-lys", "Lys Vinbar", "bar", "Natural wine", "Copenhagen", "Indre By", "Gothersgade 11, Copenhagen", 55.6823, 12.5826, 2, "1572116469696-31de0f17cc34", "Low lights, high ceilings, and 30 bottles open by the glass.", H_BAR],
  ["p-mare", "Trattoria Mare", "restaurant", "Italian", "Copenhagen", "Frederiksberg", "Gammel Kongevej 120, Copenhagen", 55.6779, 12.5402, 2, "1565299624946-b28f40a0ae38", "Coastal Italian cooking and the city's best Sunday lunch.", H_DINNER],
  // Lisbon
  ["p-azulejo", "Azulejo Café", "cafe", "Café", "Lisbon", "Príncipe Real", "Rua da Escola Politécnica 58, Lisbon", 38.7169, -9.1494, 1, "1554118811-1e0d58224f24", "Tiled walls, a tiny garden and pastéis still warm at 9am.", H_CAFE],
  ["p-tasca", "Tasca do Rio", "restaurant", "Portuguese", "Lisbon", "Alfama", "Rua de São Miguel 24, Lisbon", 38.7118, -9.1297, 2, "1504674900247-0877df9cc836", "Six tables, grilled sardines, and fado drifting in from next door.", H_DINNER],
  ["p-forno", "Forno Velho", "bakery", "Portuguese bakery", "Lisbon", "Bairro Alto", "Rua da Rosa 133, Lisbon", 38.7131, -9.1452, 1, "1555507036-ab1f4038808a", "A wood-fired oven running since the 1950s. Broa and custard tarts.", H_BAKERY],
  ["p-miradouro", "Miradouro Bar", "bar", "Rooftop bar", "Lisbon", "Graça", "Largo da Graça 9, Lisbon", 38.7163, -9.1312, 2, "1514933651103-005eec06c04b", "Sunset spritzes over the terracotta rooftops.", H_BAR],
  ["p-salbrasa", "Sal & Brasa", "restaurant", "Seafood", "Lisbon", "Cais do Sodré", "Rua Nova do Carvalho 40, Lisbon", 38.7068, -9.1443, 3, "1559339352-11d035aa65de", "Charcoal-grilled fish and vinho verde by the river.", H_DINNER],
  // Paris
  ["p-lumiere", "Café Lumière", "coffee", "Specialty coffee", "Paris", "Le Marais", "Rue Vieille du Temple 74, Paris", 48.8597, 2.3618, 1, "1445116572660-236099ec97a0", "Third-wave coffee in a 17th-century courtyard.", H_CAFE],
  ["p-ardoise", "Bistrot Ardoise", "restaurant", "French bistro", "Paris", "11e", "Rue de la Roquette 88, Paris", 48.8565, 2.3768, 2, "1550966871-3ed3cdb5ed0c", "Chalkboard menu, perfect steak frites, and no reservations after 9.", H_DINNER],
  ["p-seigle", "Maison Seigle", "bakery", "French bakery", "Paris", "Canal Saint-Martin", "Quai de Valmy 102, Paris", 48.8724, 2.3637, 1, "1555507036-ab1f4038808a", "Rye-forward boulangerie with the flakiest croissant in the 10th.", H_BAKERY],
  ["p-comptoir", "Petit Comptoir", "bar", "Wine bar", "Paris", "Pigalle", "Rue Frochot 6, Paris", 48.8818, 2.3371, 2, "1470337458703-46ad1756a187", "Standing-room wine bar with excellent charcuterie.", H_BAR],
  ["p-nonna", "Nonna Rosa", "restaurant", "Italian", "Paris", "Batignolles", "Rue des Dames 45, Paris", 48.8846, 2.3205, 2, "1574071318508-1cdbab80d002", "Neapolitan pizza and a nonna-approved tiramisu.", H_DINNER],
];

const places: Place[] = placeRows.map(
  ([id, name, category, cuisine, city, neighborhood, address, lat, lng, price, image, description, hours], i) => ({
    id,
    name,
    category,
    cuisine,
    city,
    neighborhood,
    address,
    lat,
    lng,
    priceLevel: price,
    imageUrl: img(image),
    description,
    openingHours: hours,
    createdAt: ago(200 - i * 3),
    source: "demo",
    googlePlaceId: null,
    website: null,
    googleRating: null,
    googleRatingCount: null,
  }),
);

// ---------------------------------------------------------------- Reviews
type R = [
  user: string,
  place: string,
  overall: number,
  sub: [food: number | null, drinks: number | null, atmosphere: number | null, service: number | null, value: number | null],
  text: string,
  items: string[],
  tags: ReviewTag[],
  daysAgo: number,
];

const reviewRows: R[] = [
  // Emma — coffee obsessive
  ["u-emma", "p-lumen", 5, [null, 5, 4.5, 5, 4.5], "The washed Ethiopian on filter tasted like jasmine and peach. Best cup I've had in the city this year.", ["Ethiopia filter", "Cardamom bun"], ["great coffee", "hidden gem", "solo friendly"], 1],
  ["u-emma", "p-roast", 4.5, [null, 5, 4, 4, 4], "Do the filter flight. The staff will happily nerd out with you about processing methods.", ["Filter flight", "Cortado"], ["great coffee", "laptop friendly"], 9],
  ["u-emma", "p-kade", 4, [null, 4, 5, 4, 4], "Not the most complex coffee, but on a sunny morning that terrace is unbeatable.", ["Iced filter"], ["great coffee", "outdoor seating"], 16],
  ["u-emma", "p-sora", 5, [5, 4.5, 5, 5, 4], "Worth every euro. The chef's otoro course made me go quiet for a full minute.", ["Omakase", "Sake pairing"], ["date night"], 4],
  ["u-emma", "p-brood", 4.5, [4.5, null, 3.5, 4, 5], "Cardamom knots are perfect. Get there before nine.", ["Cardamom knot", "Seeded sourdough"], ["hidden gem"], 23],
  ["u-emma", "p-kaffenord", 4.5, [null, 4.5, 5, 4, 4], "Found it on a weekend trip. Light roasts done properly.", ["Kenya pour-over"], ["great coffee"], 60],
  // Thomas — pasta
  ["u-thomas", "p-fiume", 5, [5, 4.5, 4.5, 4.5, 4.5], "Tajarin with butter and sage. That's it, that's the review. Go.", ["Tajarin", "Vitello tonnato"], ["date night", "casual dinner"], 2],
  ["u-thomas", "p-verde", 4, [4, 3.5, 3.5, 4, 5], "Fast, cheap, honest. Cacio e pepe is properly emulsified.", ["Cacio e pepe"], ["casual dinner", "solo friendly"], 12],
  ["u-thomas", "p-mare", 4.5, [4.5, 4, 4.5, 4.5, 4], "Sunday lunch here was the highlight of our Copenhagen trip.", ["Linguine alle vongole"], ["groups"], 45],
  ["u-thomas", "p-nonna", 4, [4.5, 3.5, 4, 3.5, 4.5], "Proper Neapolitan crust. Tiramisu is non-negotiable.", ["Margherita", "Tiramisu"], ["casual dinner"], 70],
  ["u-thomas", "p-brasa", 4.5, [5, 4, 4.5, 4, 3.5], "Sit at the counter and watch the grill. The txuleta is huge — share it.", ["Txuleta", "Grilled leeks"], ["groups", "date night"], 18],
  ["u-thomas", "p-panelento", 4.5, [4.5, 4, 4, 4, 5], "Focaccia with potato and rosemary, eaten on the canal edge.", ["Potato focaccia", "Maritozzo"], ["hidden gem"], 7],
  // Sarah — cafés and travel
  ["u-sarah", "p-azulejo", 5, [4.5, 4.5, 5, 5, 5], "Found an amazing little coffee place in Lisbon. The garden out back feels like a secret.", ["Galão", "Pastel de nata"], ["great coffee", "hidden gem", "brunch"], 3],
  ["u-sarah", "p-vers", 4.5, [4.5, 4, 4.5, 4, 4], "Ricotta pancakes are dangerously good. Go early on Sundays.", ["Ricotta pancakes", "Shakshuka"], ["brunch", "groups"], 6],
  ["u-sarah", "p-lumiere", 4.5, [null, 4.5, 5, 4, 4], "Courtyard coffee in the Marais — the most peaceful 20 minutes of my trip.", ["Flat white"], ["great coffee", "solo friendly"], 40],
  ["u-sarah", "p-tasca", 4.5, [4.5, 4, 5, 4.5, 5], "Sardines, a carafe of white, and the whole room singing along. Magical.", ["Grilled sardines", "Polvo à lagareiro"], ["casual dinner", "hidden gem"], 30],
  ["u-sarah", "p-lumen", 4.5, [null, 5, 4, 4.5, 4], "Emma dragged me here and she was right.", ["Espresso", "Cardamom bun"], ["great coffee"], 11],
  ["u-sarah", "p-forno", 4, [4.5, null, 3.5, 4, 5], "The broa is still warm in the morning. Nata is great, not life-changing.", ["Broa de milho"], ["hidden gem"], 32],
  // Lucas — Paris wine
  ["u-lucas", "p-comptoir", 5, [4.5, 5, 5, 4.5, 4.5], "Tell them what you like and trust the pour. Best 'standing' evening in Paris.", ["Skin-contact Loire chenin", "Jambon persillé"], ["natural wine", "late night"], 5],
  ["u-lucas", "p-ardoise", 4.5, [4.5, 4, 4.5, 4, 5], "Classic bistro, no tricks. Steak frites and a Brouilly, done.", ["Steak frites", "Île flottante"], ["casual dinner", "date night"], 14],
  ["u-lucas", "p-seigle", 5, [5, null, 4, 4, 5], "The rye croissant is the reason I moved to this arrondissement. Not joking.", ["Rye croissant", "Pain de seigle"], ["hidden gem"], 20],
  ["u-lucas", "p-fermento", 4.5, [4, 5, 4.5, 4, 4], "Visited friends in Amsterdam — finally a natural wine bar with soul.", ["Orange wine flight"], ["natural wine", "late night"], 50],
  ["u-lucas", "p-lumiere", 4, [null, 4, 4.5, 4, 3.5], "Beautiful setting, coffee a little pricey but excellent.", ["Batch brew"], ["great coffee"], 25],
  // Noor — brunch & spice
  ["u-noor", "p-tamarind", 5, [5, 4, 4, 5, 5], "The rendang has been cooking since sunrise and you can taste it. Bring friends and order everything.", ["Rendang", "Sambal goreng", "Rijsttafel"], ["groups", "casual dinner"], 2],
  ["u-noor", "p-vers", 4, [4, 4, 4.5, 3.5, 3.5], "Love the vibe, the wait on weekends is real though.", ["Turkish eggs"], ["brunch"], 10],
  ["u-noor", "p-vlinder", 4.5, [null, 5, 5, 4.5, 3.5], "The genever sour is a revelation. Dark, cosy and perfect after dinner.", ["Genever sour", "Smoked old fashioned"], ["date night", "late night"], 8],
  ["u-noor", "p-brasa", 4, [4.5, 4, 4, 3.5, 3.5], "Gorgeous grilled fish. A bit loud for a date.", ["Whole turbot"], ["groups"], 21],
  // Julia — Copenhagen
  ["u-julia", "p-havn", 5, [5, 4, 4, 4.5, 5], "These are the cardamom buns I measure all others against.", ["Cardamom bun", "Rye loaf"], ["hidden gem"], 3],
  ["u-julia", "p-saltvand", 4.5, [5, 4.5, 4.5, 4.5, 3.5], "Tasting menu tasted like the harbour, in the best way.", ["Langoustine", "Brown butter cod"], ["date night"], 13],
  ["u-julia", "p-kaffenord", 4.5, [null, 4.5, 5, 4.5, 4.5], "My Saturday ritual. Window seat, filter, book.", ["Filter of the day"], ["great coffee", "solo friendly"], 6],
  ["u-julia", "p-lys", 4, [3.5, 4.5, 5, 4, 3.5], "Gorgeous room, big glass list. Snacks are fine.", ["Glass of Jura savagnin"], ["natural wine", "date night"], 27],
  ["u-julia", "p-mare", 4, [4, 4, 4, 4, 4], "Solid neighbourhood Italian. Book Sunday lunch.", ["Spaghetti al limone"], ["groups"], 35],
  // Inês — Lisbon curator (followed)
  ["u-ines", "p-tasca", 5, [5, 4.5, 5, 5, 5], "This is the Alfama my grandmother described. Order the octopus.", ["Polvo à lagareiro", "Sardines"], ["casual dinner", "hidden gem"], 4],
  ["u-ines", "p-miradouro", 4.5, [null, 4, 5, 4, 4], "Go 40 minutes before sunset. Thank me later.", ["White port tonic"], ["date night", "outdoor seating"], 9],
  ["u-ines", "p-salbrasa", 4.5, [5, 4.5, 4, 4, 4], "Seabass from the coals with nothing but salt and lemon. Perfect.", ["Robalo grelhado"], ["date night"], 15],
  ["u-ines", "p-azulejo", 4.5, [4.5, 4, 5, 4.5, 4.5], "My go-to for a slow morning.", ["Tosta mista", "Galão"], ["brunch", "great coffee"], 19],
  ["u-ines", "p-forno", 5, [5, null, 4, 4.5, 5], "Old oven, old recipes, no nonsense.", ["Broa", "Pastel de nata"], ["hidden gem"], 26],
  // Mateo, Freya, Daan — wider community
  ["u-mateo", "p-vlinder", 5, [null, 5, 5, 4.5, 4], "Best cocktail bar in Amsterdam, full stop.", ["Seasonal menu"], ["late night", "date night"], 3],
  ["u-mateo", "p-fermento", 4, [3.5, 4.5, 4.5, 3.5, 4], "Great wines, the ferry ride is part of the fun.", ["Pét-nat"], ["natural wine", "late night"], 12],
  ["u-freya", "p-saltvand", 5, [5, 4.5, 5, 5, 4], "Every course felt considered. A special-occasion place.", ["Tasting menu"], ["date night"], 8],
  ["u-freya", "p-havn", 4.5, [4.5, 4, 4, 4, 5], "The rye is exceptional. Buns are, of course, legendary.", ["Rye loaf"], ["hidden gem"], 22],
  ["u-daan", "p-brood", 5, [5, 4, 4, 4.5, 5], "Seeded sourdough that lasts four days. Worth the queue.", ["Seeded sourdough"], ["hidden gem"], 5],
  ["u-daan", "p-panelento", 4.5, [4.5, 4, 4, 4, 4.5], "Maritozzi are criminally good.", ["Maritozzo"], ["hidden gem"], 14],
  ["u-daan", "p-seigle", 4.5, [5, null, 4, 4, 4.5], "Made a pilgrimage on a Paris weekend. Croissant lived up to the hype.", ["Rye croissant"], ["hidden gem"], 44],
  // Alex (me) — builds the taste profile
  ["u-alex", "p-lumen", 4.5, [null, 5, 4.5, 4.5, 4], "My weekday ritual. The cortado is perfectly balanced.", ["Cortado"], ["great coffee", "solo friendly"], 6],
  ["u-alex", "p-verde", 4.5, [4.5, 3.5, 4, 4, 5], "Quick, cheap, and the cacio e pepe is spot on.", ["Cacio e pepe", "Burrata"], ["casual dinner", "solo friendly"], 20],
  ["u-alex", "p-vers", 4, [4, 4, 4.5, 3.5, 3.5], "Lovely brunch spot, just go early.", ["Ricotta pancakes"], ["brunch"], 34],
  ["u-alex", "p-roast", 4, [null, 4.5, 3.5, 4, 4], "Excellent beans to take home. Seating is limited.", ["Filter flight"], ["great coffee"], 48],
  ["u-alex", "p-fiume", 5, [5, 4.5, 4.5, 5, 4.5], "Thomas was right. The tajarin is unreal.", ["Tajarin", "Panna cotta"], ["date night"], 15],
];

const reviews: Review[] = reviewRows.map(([userId, placeId, overall, sub, text, items, tags, d], i) => ({
  id: `r-${i + 1}`,
  userId,
  placeId,
  overall,
  food: sub[0],
  drinks: sub[1],
  atmosphere: sub[2],
  service: sub[3],
  value: sub[4],
  text,
  photos: [],
  visitedOn: ago(d + 1).slice(0, 10),
  priceLevel: places.find((p) => p.id === placeId)?.priceLevel ?? null,
  recommendedItems: items,
  tags,
  createdAt: ago(d, i % 7),
  updatedAt: ago(d, i % 7),
}));

// ---------------------------------------------------------------- Social graph
const friendPairs: [string, string, number][] = [
  [DEMO_ME_ID, "u-emma", 300],
  ["u-thomas", DEMO_ME_ID, 280],
  [DEMO_ME_ID, "u-sarah", 260],
  ["u-lucas", DEMO_ME_ID, 200],
  [DEMO_ME_ID, "u-noor", 180],
  ["u-julia", DEMO_ME_ID, 150],
  ["u-emma", "u-sarah", 340],
  ["u-thomas", "u-emma", 300],
  ["u-julia", "u-freya", 190],
  ["u-sarah", "u-ines", 220],
];

const friendships: Friendship[] = [
  ...friendPairs.map(([a, b, d], i) => ({
    id: `f-${i + 1}`,
    requesterId: a,
    addresseeId: b,
    status: "accepted" as const,
    createdAt: ago(d),
  })),
  { id: "f-pending-in", requesterId: "u-mateo", addresseeId: DEMO_ME_ID, status: "pending", createdAt: ago(0, 5) },
  { id: "f-pending-out", requesterId: DEMO_ME_ID, addresseeId: "u-daan", status: "pending", createdAt: ago(2) },
];

const follows: Follow[] = [
  { id: "fo-1", followerId: DEMO_ME_ID, followeeId: "u-ines", createdAt: ago(100) },
  { id: "fo-2", followerId: "u-sarah", followeeId: "u-ines", createdAt: ago(120) },
  { id: "fo-3", followerId: "u-freya", followeeId: DEMO_ME_ID, createdAt: ago(30) },
];

// ---------------------------------------------------------------- Collections
type C = [id: string, user: string, title: string, description: string, visibility: Collection["visibility"], placeIds: string[], cover: string | null, daysAgo: number];

const collectionRows: C[] = [
  ["c-emma-coffee", "u-emma", "Best coffee in Amsterdam", "Every cup on this list has been tasted at least three times. Filter first, milk second.", "public", ["p-lumen", "p-roast", "p-kade"], img("1495474472287-4d71bcdd2085"), 12],
  ["c-thomas-italian", "u-thomas", "My favorite Italian restaurants", "From fresh tajarin in De Pijp to Neapolitan pizza in Batignolles.", "public", ["p-fiume", "p-verde", "p-panelento", "p-mare", "p-nonna"], img("1473093295043-cdd812d0e601"), 20],
  ["c-alex-date", DEMO_ME_ID, "Date night recommendations", "Candles, counters and cocktails.", "friends", ["p-kanaal", "p-sora", "p-vlinder", "p-fiume"], img("1414235077428-338989a2e8c0"), 25],
  ["c-alex-want", DEMO_ME_ID, "Places I want to visit", "My running list of places friends keep telling me about.", "private", ["p-sora", "p-havn", "p-saltvand", "p-azulejo", "p-tamarind"], null, 3],
  ["c-julia-cph", "u-julia", "Best restaurants in Copenhagen", "Where I take visiting friends. Book ahead for Saltvand.", "public", ["p-saltvand", "p-mare", "p-lys", "p-havn", "p-kaffenord"], img("1559339352-11d035aa65de"), 30],
  ["c-lucas-paris", "u-lucas", "Hidden gems in Paris", "No queues of tourists, just very good things.", "public", ["p-seigle", "p-comptoir", "p-ardoise", "p-lumiere", "p-nonna"], img("1550966871-3ed3cdb5ed0c"), 18],
  ["c-ines-lisbon", "u-ines", "A slow day in Lisbon", "Breakfast to sunset, without rushing.", "public", ["p-azulejo", "p-forno", "p-tasca", "p-miradouro", "p-salbrasa"], img("1554118811-1e0d58224f24"), 9],
];

const collections: Collection[] = collectionRows.map(([id, userId, title, description, visibility, , cover, d]) => ({
  id,
  userId,
  title,
  description,
  visibility,
  coverImage: cover,
  createdAt: ago(d),
  updatedAt: ago(d),
}));

const collectionPlaces: CollectionPlace[] = collectionRows.flatMap(([cid, , , , , placeIds]) =>
  placeIds.map((placeId, position) => ({ id: `cp-${cid}-${placeId}`, collectionId: cid, placeId, position })),
);

const collectionFollows: CollectionFollow[] = [
  { id: "cf-1", userId: DEMO_ME_ID, collectionId: "c-emma-coffee", createdAt: ago(10) },
  { id: "cf-2", userId: DEMO_ME_ID, collectionId: "c-ines-lisbon", createdAt: ago(8) },
  { id: "cf-3", userId: "u-noor", collectionId: "c-alex-date", createdAt: ago(1) },
  { id: "cf-4", userId: "u-sarah", collectionId: "c-ines-lisbon", createdAt: ago(7) },
];

// ---------------------------------------------------------------- Saved places
const savedRows: [string, string, number][] = [
  [DEMO_ME_ID, "p-sora", 4],
  [DEMO_ME_ID, "p-kanaal", 12],
  [DEMO_ME_ID, "p-havn", 20],
  [DEMO_ME_ID, "p-azulejo", 2],
  [DEMO_ME_ID, "p-tamarind", 1],
  [DEMO_ME_ID, "p-panelento", 9],
  ["u-emma", "p-azulejo", 3],
  ["u-emma", "p-forno", 5],
  ["u-thomas", "p-salbrasa", 2],
  ["u-thomas", "p-kanaal", 1],
  ["u-sarah", "p-miradouro", 4],
  ["u-sarah", "p-salbrasa", 6],
  ["u-noor", "p-tasca", 3],
  ["u-noor", "p-azulejo", 8],
  ["u-julia", "p-fiume", 2],
  ["u-lucas", "p-tasca", 15],
  ["u-noor", "p-sora", 0],
  ["u-thomas", "p-fermento", 0],
  ["u-emma", "p-saltvand", 6],
  ["u-thomas", "p-havn", 11],
  ["u-noor", "p-lys", 4],
  ["u-sarah", "p-kaffenord", 13],
];

const saved: SavedPlace[] = savedRows.map(([userId, placeId, d], i) => ({
  id: `s-${i + 1}`,
  userId,
  placeId,
  createdAt: ago(d, i),
}));

// ---------------------------------------------------------------- Recommendations & notifications
const recommendations: PlaceRecommendation[] = [
  { id: "rec-1", senderId: "u-emma", receiverId: DEMO_ME_ID, placeId: "p-sora", message: "You need to try the omakase. Book for a Thursday — calmer room.", createdAt: ago(0, 3) },
  { id: "rec-2", senderId: "u-sarah", receiverId: DEMO_ME_ID, placeId: "p-azulejo", message: "Found an amazing little coffee place in Lisbon. You need to try this.", createdAt: ago(1, 2) },
  { id: "rec-3", senderId: "u-thomas", receiverId: DEMO_ME_ID, placeId: "p-brasa", message: "Counter seats. Trust me.", createdAt: ago(5) },
];

const notifications: AppNotification[] = [
  { id: "n-1", userId: DEMO_ME_ID, actorId: "u-mateo", type: "friend_request", referenceId: "f-pending-in", isRead: false, createdAt: ago(0, 5) },
  { id: "n-2", userId: DEMO_ME_ID, actorId: "u-emma", type: "recommendation", referenceId: "rec-1", isRead: false, createdAt: ago(0, 3) },
  { id: "n-3", userId: DEMO_ME_ID, actorId: "u-noor", type: "collection_follow", referenceId: "c-alex-date", isRead: false, createdAt: ago(1) },
  { id: "n-4", userId: DEMO_ME_ID, actorId: "u-sarah", type: "recommendation", referenceId: "rec-2", isRead: true, createdAt: ago(1, 2) },
  { id: "n-5", userId: DEMO_ME_ID, actorId: "u-freya", type: "new_follower", referenceId: null, isRead: true, createdAt: ago(30) },
];

export function createDemoDatabase(): Database {
  // Return fresh copies so mutations never touch module state.
  return structuredClone({
    profiles,
    places,
    reviews,
    friendships,
    follows,
    collections,
    collectionPlaces,
    collectionFollows,
    saved,
    recommendations,
    notifications,
  });
}

/** Static lookup used by server-rendered share pages in demo mode. */
export const demoPlaces = places;
export const demoProfiles = profiles;
export const demoCollections = collections;
export const demoCollectionPlaces = collectionPlaces;
export const demoReviews = reviews;
