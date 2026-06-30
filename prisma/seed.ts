import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // Clean
  await prisma.item.deleteMany();
  await prisma.category.deleteMany();
  await prisma.user.deleteMany();
  await prisma.restaurant.deleteMany();

  // Hash passwords
  const adminHash = await bcrypt.hash("admin1234", 10);
  const userHash = await bcrypt.hash("demo1234", 10);

  // ─── 1. Super Admin ─────────────────────────────────────────────────────
  await prisma.user.create({
    data: {
      name: "Super Admin",
      email: "admin@menuqr.com",
      password: adminHash,
      role: "super_admin",
    },
  });

  // ─── 2. Restaurant avec ses catégories ──────────────────────────────────
  const restaurant = await prisma.restaurant.create({
    data: {
      slug: "le-petit-bistrot",
      name: "Le Petit Bistrot",
      logoUrl: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=200&h=200&fit=crop",
      bannerUrl: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200&h=500&fit=crop",
      categories: {
        create: [
          { nameFr: "Entrées", nameEn: "Starters", sortOrder: 1 },
          { nameFr: "Plats", nameEn: "Main Courses", sortOrder: 2 },
          { nameFr: "Desserts", nameEn: "Desserts", sortOrder: 3 },
          { nameFr: "Boissons", nameEn: "Drinks", sortOrder: 4 },
        ],
      },
    },
    include: { categories: true },
  });

  // ─── 3. Restaurateur lié au restaurant ──────────────────────────────────
  await prisma.user.create({
    data: {
      name: "Chef Bistrot",
      email: "restaurateur@petitbistrot.fr",
      password: userHash,
      role: "restaurateur",
      restaurantId: restaurant.id,
    },
  });

  // ─── 4. Items du menu ───────────────────────────────────────────────────
  const catMap = Object.fromEntries(restaurant.categories.map((c) => [c.nameFr, c.id]));
  const rId = restaurant.id;

  const itemsData = [
    { categoryId: catMap["Entrées"], items: [
      { nameFr: "Salade César", nameEn: "Caesar Salad", descriptionFr: "Laitue romaine croquante, croûtons dorés à l'ail, copeaux de parmesan 24 mois et notre sauce César maison à l'anchois.", descriptionEn: "Crispy romaine lettuce, garlic croutons, 24-month parmesan shavings and our homemade anchovy Caesar dressing.", price: 2500, imageUrl: "https://images.unsplash.com/photo-1546793665-c74683f339c1?w=400&h=300&fit=crop", isAvailable: true },
      { nameFr: "Soupe du Jour", nameEn: "Soup of the Day", descriptionFr: "Potage velouté de saison préparé chaque matin avec des produits frais du marché, servi avec du pain artisanal grillé.", descriptionEn: "Seasonal velvety soup prepared each morning with fresh market produce, served with toasted artisan bread.", price: 1500, imageUrl: "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=400&h=300&fit=crop", isAvailable: true },
      { nameFr: "Bruschetta Tomates Basilic", nameEn: "Tomato Basil Bruschetta", descriptionFr: "Tartines de pain de campagne grillées, tomates concassées, basilic frais, ail et huile d'olive extra vierge.", descriptionEn: "Grilled country bread topped with crushed tomatoes, fresh basil, garlic and extra virgin olive oil.", price: 2000, imageUrl: "https://images.unsplash.com/photo-1572695157366-5e585ab2b69f?w=400&h=300&fit=crop", isAvailable: true },
      { nameFr: "Tartare de Saumon", nameEn: "Salmon Tartare", descriptionFr: "Saumon frais coupé en dés, avocat, citron vert, échalote ciselée et sésame noir.", descriptionEn: "Fresh diced salmon, avocado, lime, minced shallot and black sesame.", price: 4500, imageUrl: "https://images.unsplash.com/photo-1626645738196-c2a7c87a8f58?w=400&h=300&fit=crop", isAvailable: false },
      { nameFr: "Escargots de Bourgogne", nameEn: "Burgundy Snails", descriptionFr: "Six escargots servis dans leur coquille, beurre persillé généreux et pain à croûte croustillante.", descriptionEn: "Six snails served in their shells with generous parsley butter and crispy crust bread.", price: 3500, imageUrl: "https://images.unsplash.com/photo-1603105037880-880cd4f9004d?w=400&h=300&fit=crop", isAvailable: true },
    ]},
    { categoryId: catMap["Plats"], items: [
      { nameFr: "Steak Frites", nameEn: "Steak & Fries", descriptionFr: "Entrecôte grillée 200g de bœuf Angus, frites croustillantes maison et sauce béarnaise onctueuse.", descriptionEn: "200g grilled Angus ribeye, crispy homemade fries and creamy béarnaise sauce.", price: 5500, imageUrl: "https://images.unsplash.com/photo-1600891964092-4316c288032e?w=400&h=300&fit=crop", isAvailable: true },
      { nameFr: "Saumon Grillé", nameEn: "Grilled Salmon", descriptionFr: "Filet de saumon sauvage grillé, légumes de saison rôtis au four et beurre citronné au thym.", descriptionEn: "Grilled wild salmon fillet, oven-roasted seasonal vegetables and lemon-thyme butter.", price: 5000, imageUrl: "https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=400&h=300&fit=crop", isAvailable: true },
      { nameFr: "Risotto aux Champignons", nameEn: "Mushroom Risotto", descriptionFr: "Riz arborio crémeux cuit lentement, mélange de champignons de Paris, shiitaké et pleurotes, parmesan râpé.", descriptionEn: "Slowly cooked creamy arborio rice, blend of button, shiitake and oyster mushrooms, grated parmesan.", price: 4500, imageUrl: "https://images.unsplash.com/photo-1476124369491-e7addf5db371?w=400&h=300&fit=crop", isAvailable: true },
      { nameFr: "Confit de Canard", nameEn: "Duck Confit", descriptionFr: "Cuisse de canard confite lentement, pommes de terre grenaille rôties et salade de roquette.", descriptionEn: "Slowly confited duck leg, roasted baby potatoes and arugula salad.", price: 6000, imageUrl: "https://images.unsplash.com/photo-1580554530778-ca36943571b8?w=400&h=300&fit=crop", isAvailable: true, videoUrl: "/uploads/demo/confit-canard.mp4" },
      { nameFr: "Bouillabaisse", nameEn: "Bouillabaisse", descriptionFr: "Ragoût de poissons de roche et fruits de mer, bouillon saffrané, rouille et croûtons aillés.", descriptionEn: "Rock fish and seafood stew, saffron broth, rouille and garlic croutons.", price: 7500, imageUrl: "https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=400&h=300&fit=crop", isAvailable: false },
      { nameFr: "Blanquette de Veau", nameEn: "Veal Blanquette", descriptionFr: "Veau mijoté dans un bouillon blanc onctueux, carottes, champignons, et riz pilaf parfumé.", descriptionEn: "Braised veal in a creamy white broth, carrots, mushrooms, and fragrant pilaf rice.", price: 5500, imageUrl: "https://images.unsplash.com/photo-1547592180-85f173990554?w=400&h=300&fit=crop", isAvailable: true },
      { nameFr: "Tagliatelles Carbonara", nameEn: "Carbonara Tagliatelle", descriptionFr: "Pâtes fraîches maison, lardons fumés, crème, jaune d'œuf et pecorino romano.", descriptionEn: "Homemade fresh pasta, smoked bacon, cream, egg yolk and pecorino romano.", price: 4000, imageUrl: "https://images.unsplash.com/photo-1612874742237-6526221588e3?w=400&h=300&fit=crop", isAvailable: true },
      { nameFr: "Côte d'Agneau", nameEn: "Lamb Cutlet", descriptionFr: "Côte d'agneau de lait grillée, jus de romarin, ratatouille provençale et polenta crémeuse.", descriptionEn: "Grilled milk-fed lamb cutlet, rosemary jus, Provençal ratatouille and creamy polenta.", price: 7000, imageUrl: "https://images.unsplash.com/photo-1514516345957-556ca7d90a29?w=400&h=300&fit=crop", isAvailable: true },
      { nameFr: "Poulet Rôti Fermier", nameEn: "Free-Range Roast Chicken", descriptionFr: "Poulet entier rôti aux herbes de Provence, pommes grenaille, sauce jus de cuisson.", descriptionEn: "Whole free-range chicken roasted with Provençal herbs, baby potatoes, cooking jus sauce.", price: 5000, imageUrl: "https://images.unsplash.com/photo-1598103442097-8b74394b95c6?w=400&h=300&fit=crop", isAvailable: true },
      { nameFr: "Filet de Bar", nameEn: "Sea Bass Fillet", descriptionFr: "Bar de ligne grillé, émulsion d'herbes fraîches, fenouil braisé et grains de sarrasin.", descriptionEn: "Grilled line-caught sea bass, fresh herb emulsion, braised fennel and buckwheat grains.", price: 6500, imageUrl: "https://images.unsplash.com/photo-1535399831218-d5bd36d1a6b3?w=400&h=300&fit=crop", isAvailable: true, videoUrl: "/uploads/demo/filet-bar.mp4" },
      { nameFr: "Gratin Dauphinois", nameEn: "Dauphinoise Gratin", descriptionFr: "Gratin traditionnel de pommes de terre fines, crème entière, ail et gruyère fondu (portion généreuse).", descriptionEn: "Traditional thin potato gratin, heavy cream, garlic and melted gruyère (generous portion).", price: 2500, imageUrl: "https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=400&h=300&fit=crop", isAvailable: true },
    ]},
    { categoryId: catMap["Desserts"], items: [
      { nameFr: "Crème Brûlée", nameEn: "Crème Brûlée", descriptionFr: "Crème onctueuse à la vanille de Madagascar, caramélisée au chalumeau juste avant service.", descriptionEn: "Silky Madagascar vanilla cream, caramelized with a blowtorch just before serving.", price: 2000, imageUrl: "https://images.unsplash.com/photo-1470124182917-cc6e71b22ecc?w=400&h=300&fit=crop", isAvailable: true },
      { nameFr: "Tiramisu", nameEn: "Tiramisu", descriptionFr: "Mascarpone onctueux, biscuits imbibés de café espresso, cacao amer du Pérou.", descriptionEn: "Creamy mascarpone, espresso-soaked ladyfingers, bitter Peruvian cocoa.", price: 2500, imageUrl: "https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=400&h=300&fit=crop", isAvailable: true },
      { nameFr: "Fondant au Chocolat", nameEn: "Chocolate Fondant", descriptionFr: "Cœur coulant au chocolat noir 70% de Valrhona, glace vanille de Madagascar.", descriptionEn: "Molten center of 70% Valrhona dark chocolate, Madagascar vanilla ice cream.", price: 2500, imageUrl: "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=400&h=300&fit=crop", isAvailable: true },
      { nameFr: "Tarte Tatin", nameEn: "Tarte Tatin", descriptionFr: "Tarte aux pommes caramélisées renversées, pâte feuilletée croustillante et crème fraîche.", descriptionEn: "Upside-down caramelized apple tart, crispy puff pastry and fresh cream.", price: 2000, imageUrl: "https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=400&h=300&fit=crop", isAvailable: true },
      { nameFr: "Profiteroles", nameEn: "Profiteroles", descriptionFr: "Choux croustillants garnis de crème pâtissière, sauce chocolat chaud amère.", descriptionEn: "Crispy choux filled with pastry cream, hot bitter chocolate sauce.", price: 2500, imageUrl: "https://images.unsplash.com/photo-1558303025-34024e1e0477?w=400&h=300&fit=crop", isAvailable: false },
      { nameFr: "Panna Cotta", nameEn: "Panna Cotta", descriptionFr: "Crème italienne onctueuse à la vanille, coulis de fruits rouges frais de saison.", descriptionEn: "Silky Italian vanilla cream, fresh seasonal red berry coulis.", price: 2000, imageUrl: "https://images.unsplash.com/photo-1488477181946-6428a0291777?w=400&h=300&fit=crop", isAvailable: true },
      { nameFr: "Île Flottante", nameEn: "Floating Island", descriptionFr: "Meringue légère sur crème anglaise, pralin et fil de caramel.", descriptionEn: "Light meringue on custard, praline and caramel drizzle.", price: 1500, imageUrl: "https://images.unsplash.com/photo-1562007908-17c67e878c88?w=400&h=300&fit=crop", isAvailable: true },
    ]},
    { categoryId: catMap["Boissons"], items: [
      { nameFr: "Eau Minérale", nameEn: "Mineral Water", descriptionFr: "Bouteille 50cl — Plate ou gazeuse au choix.", descriptionEn: "50cl bottle — Still or sparkling, your choice.", price: 500, imageUrl: "https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=400&h=300&fit=crop", isAvailable: true },
      { nameFr: "Vin Rouge — Verre", nameEn: "Red Wine — Glass", descriptionFr: "Sélection du sommelier — Côtes du Rhône ou Bordeaux selon arrivage. Verre 15cl.", descriptionEn: "Sommelier's selection — Côtes du Rhône or Bordeaux depending on availability. 15cl glass.", price: 1500, imageUrl: "https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=400&h=300&fit=crop", isAvailable: true },
      { nameFr: "Vin Blanc — Verre", nameEn: "White Wine — Glass", descriptionFr: "Sancerre ou Chablis selon arrivage. Verre 15cl, servi frais.", descriptionEn: "Sancerre or Chablis depending on availability. 15cl glass, served chilled.", price: 1500, imageUrl: "https://images.unsplash.com/photo-1566995541428-f2246c17cda1?w=400&h=300&fit=crop", isAvailable: true },
      { nameFr: "Pression Artisanale", nameEn: "Craft Draft Beer", descriptionFr: "Bière blonde artisanale locale, servie fraîche — 33cl.", descriptionEn: "Local artisan blonde beer, served cold — 33cl.", price: 1500, imageUrl: "https://images.unsplash.com/photo-1535958636474-b021ee887b13?w=400&h=300&fit=crop", isAvailable: true },
      { nameFr: "Limonade Maison", nameEn: "Homemade Lemonade", descriptionFr: "Limonade fraîche pressée à la commande, menthe et citron vert.", descriptionEn: "Freshly squeezed lemonade made to order, mint and lime.", price: 1000, imageUrl: "https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400&h=300&fit=crop", isAvailable: true },
      { nameFr: "Espresso", nameEn: "Espresso", descriptionFr: "Café espresso pur, torréfaction artisanale.", descriptionEn: "Pure espresso coffee, artisan roast.", price: 500, imageUrl: "https://images.unsplash.com/photo-1510707577719-ae7c14805e3a?w=400&h=300&fit=crop", isAvailable: true },
      { nameFr: "Pot de Thé", nameEn: "Pot of Tea", descriptionFr: "Sélection de thés premium — Earl Grey, Darjeeling, Menthe Poivrée.", descriptionEn: "Premium tea selection — Earl Grey, Darjeeling, Peppermint.", price: 500, imageUrl: "https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400&h=300&fit=crop", isAvailable: true },
      { nameFr: "Jus de Fruits Frais", nameEn: "Fresh Fruit Juice", descriptionFr: "Orange, pomme-gingembre ou ananas-passion — pressé à la commande.", descriptionEn: "Orange, apple-ginger or pineapple-passion — freshly pressed to order.", price: 1000, imageUrl: "https://images.unsplash.com/photo-1534353473418-4cfa6c56fd38?w=400&h=300&fit=crop", isAvailable: true },
    ]},
  ];

  let totalItems = 0;
  for (const group of itemsData) {
    for (const item of group.items) {
      await prisma.item.create({
        data: { restaurantId: rId, categoryId: group.categoryId, ...item },
      });
      totalItems++;
    }
  }

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  Seed terminé avec succès");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("");
  console.log("  SUPER ADMIN");
  console.log("    Email    : admin@menuqr.com");
  console.log("    Password : admin1234");
  console.log("    Route    : /admin");
  console.log("");
  console.log("  RESTAURATEUR");
  console.log("    Email    : restaurateur@petitbistrot.fr");
  console.log("    Password : demo1234");
  console.log("    Route    : /dashboard");
  console.log("");
  console.log(`  RESTAURANT  : ${restaurant.name} (${restaurant.slug})`);
  console.log(`  CATÉGORIES  : ${restaurant.categories.length}`);
  console.log(`  PLATS       : ${totalItems}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

main()
  .then(async () => { await prisma.$disconnect(); })
  .catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });