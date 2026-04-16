import { query, initializeDatabase, closeDatabase } from '../src/backend/db/database.js';
import { callTextAPI } from '../src/shared/ai/claude-client.js';
import { v4 as uuidv4 } from 'uuid';
import { readFileSync, writeFileSync, existsSync } from 'fs';

const PROGRESS_FILE = 'data/reference-gen-progress.json';

// ─── Category Definitions ────────────────────────────────────────────────────

const CATEGORIES = {
    "Women's Clothing": [
        { brand: 'Lululemon', name: 'Leggings', subcategory: 'Bottoms' },
        { brand: 'Lululemon', name: 'Sports Bra', subcategory: 'Tops' },
        { brand: 'Lululemon', name: 'Jacket', subcategory: 'Outerwear' },
        { brand: 'Lululemon', name: 'Shorts', subcategory: 'Bottoms' },
        { brand: 'Free People', name: 'Dress', subcategory: 'Dresses' },
        { brand: 'Free People', name: 'Top', subcategory: 'Tops' },
        { brand: 'Free People', name: 'Sweater', subcategory: 'Tops' },
        { brand: 'Anthropologie', name: 'Dress', subcategory: 'Dresses' },
        { brand: 'Anthropologie', name: 'Blouse', subcategory: 'Tops' },
        { brand: 'Anthropologie', name: 'Skirt', subcategory: 'Bottoms' },
        { brand: 'Zara', name: 'Blazer', subcategory: 'Jackets' },
        { brand: 'Zara', name: 'Dress', subcategory: 'Dresses' },
        { brand: 'Zara', name: 'Jeans', subcategory: 'Bottoms' },
        { brand: 'Madewell', name: 'Jeans', subcategory: 'Bottoms' },
        { brand: 'Madewell', name: 'Transport Tote', subcategory: 'Bags' },
        { brand: 'Madewell', name: 'Top', subcategory: 'Tops' },
        { brand: 'J.Crew', name: 'Blazer', subcategory: 'Jackets' },
        { brand: 'J.Crew', name: 'Sweater', subcategory: 'Tops' },
        { brand: 'J.Crew', name: 'Coat', subcategory: 'Outerwear' },
        { brand: 'Reformation', name: 'Dress', subcategory: 'Dresses' },
        { brand: 'Reformation', name: 'Top', subcategory: 'Tops' },
        { brand: 'Everlane', name: 'Jeans', subcategory: 'Bottoms' },
        { brand: 'Everlane', name: 'Cashmere Sweater', subcategory: 'Tops' },
        { brand: 'Everlane', name: 'Tee', subcategory: 'Tops' },
        { brand: 'LOFT', name: 'Dress', subcategory: 'Dresses' },
        { brand: 'LOFT', name: 'Blazer', subcategory: 'Jackets' },
        { brand: 'LOFT', name: 'Pants', subcategory: 'Bottoms' },
        { brand: 'Ann Taylor', name: 'Dress', subcategory: 'Dresses' },
        { brand: 'Ann Taylor', name: 'Suit', subcategory: 'Suiting' },
        { brand: 'Ann Taylor', name: 'Blouse', subcategory: 'Tops' },
        { brand: 'Express', name: 'Bodysuit', subcategory: 'Tops' },
        { brand: 'Express', name: 'Jeans', subcategory: 'Bottoms' },
        { brand: 'Banana Republic', name: 'Dress', subcategory: 'Dresses' },
        { brand: 'Banana Republic', name: 'Pants', subcategory: 'Bottoms' },
        { brand: 'Banana Republic', name: 'Blazer', subcategory: 'Jackets' },
        { brand: 'Urban Outfitters', name: 'Dress', subcategory: 'Dresses' },
        { brand: 'Urban Outfitters', name: 'Top', subcategory: 'Tops' },
        { brand: 'Urban Outfitters', name: 'Jeans', subcategory: 'Bottoms' },
        { brand: 'Forever 21', name: 'Dress', subcategory: 'Dresses' },
        { brand: 'Forever 21', name: 'Crop Top', subcategory: 'Tops' },
        { brand: 'H&M', name: 'Dress', subcategory: 'Dresses' },
        { brand: 'H&M', name: 'Blazer', subcategory: 'Jackets' },
        { brand: 'H&M', name: 'Coat', subcategory: 'Outerwear' },
        { brand: 'Aritzia', name: 'Leggings', subcategory: 'Bottoms' },
        { brand: 'Aritzia', name: 'Jacket', subcategory: 'Outerwear' },
        { brand: 'Aritzia', name: 'Bodysuit', subcategory: 'Tops' },
        { brand: 'Eileen Fisher', name: 'Top', subcategory: 'Tops' },
        { brand: 'Eileen Fisher', name: 'Pants', subcategory: 'Bottoms' },
        { brand: 'Eileen Fisher', name: 'Cardigan', subcategory: 'Tops' },
        { brand: 'Theory', name: 'Blazer', subcategory: 'Jackets' },
        { brand: 'Theory', name: 'Dress', subcategory: 'Dresses' },
        { brand: 'Theory', name: 'Pants', subcategory: 'Bottoms' },
        { brand: 'Vince', name: 'Sweater', subcategory: 'Tops' },
        { brand: 'Vince', name: 'Leather Jacket', subcategory: 'Outerwear' },
        { brand: 'Alice + Olivia', name: 'Dress', subcategory: 'Dresses' },
        { brand: 'Alice + Olivia', name: 'Skirt', subcategory: 'Bottoms' },
    ],

    "Men's Clothing": [
        { brand: 'Ralph Lauren', name: 'Polo', subcategory: 'Tops' },
        { brand: 'Ralph Lauren', name: 'Oxford Shirt', subcategory: 'Tops' },
        { brand: 'Ralph Lauren', name: 'Chinos', subcategory: 'Bottoms' },
        { brand: 'Tommy Hilfiger', name: 'Jacket', subcategory: 'Outerwear' },
        { brand: 'Tommy Hilfiger', name: 'Polo', subcategory: 'Tops' },
        { brand: 'Tommy Hilfiger', name: 'Jeans', subcategory: 'Bottoms' },
        { brand: 'Calvin Klein', name: 'Underwear', subcategory: 'Underwear' },
        { brand: 'Calvin Klein', name: 'Jeans', subcategory: 'Bottoms' },
        { brand: 'Calvin Klein', name: 'Suit', subcategory: 'Suiting' },
        { brand: 'Brooks Brothers', name: 'Dress Shirt', subcategory: 'Tops' },
        { brand: 'Brooks Brothers', name: 'Suit', subcategory: 'Suiting' },
        { brand: 'Brooks Brothers', name: 'Tie', subcategory: 'Accessories' },
        { brand: 'Vineyard Vines', name: 'Shep Shirt', subcategory: 'Tops' },
        { brand: 'Vineyard Vines', name: 'Shorts', subcategory: 'Bottoms' },
        { brand: 'Bonobos', name: 'Chinos', subcategory: 'Bottoms' },
        { brand: 'Bonobos', name: 'Shirt', subcategory: 'Tops' },
        { brand: 'J.Crew', name: 'Chinos', subcategory: 'Bottoms' },
        { brand: 'J.Crew', name: 'Blazer', subcategory: 'Jackets' },
        { brand: 'J.Crew', name: 'Sweater', subcategory: 'Tops' },
        { brand: 'Banana Republic', name: 'Suit', subcategory: 'Suiting' },
        { brand: 'Banana Republic', name: 'Chinos', subcategory: 'Bottoms' },
        { brand: 'Express', name: 'Dress Shirt', subcategory: 'Tops' },
        { brand: 'Express', name: 'Jeans', subcategory: 'Bottoms' },
        { brand: 'Hugo Boss', name: 'Suit', subcategory: 'Suiting' },
        { brand: 'Hugo Boss', name: 'Dress Shirt', subcategory: 'Tops' },
        { brand: 'Ted Baker', name: 'Blazer', subcategory: 'Jackets' },
        { brand: 'Ted Baker', name: 'Shirt', subcategory: 'Tops' },
    ],

    'Denim': [
        { brand: "Levi's", name: '501 Jeans', subcategory: 'Straight' },
        { brand: "Levi's", name: '505 Jeans', subcategory: 'Regular' },
        { brand: "Levi's", name: '511 Jeans', subcategory: 'Slim' },
        { brand: "Levi's", name: '517 Jeans', subcategory: 'Bootcut' },
        { brand: "Levi's", name: '569 Jeans', subcategory: 'Loose' },
        { brand: 'Wrangler', name: 'Jeans', subcategory: 'Straight' },
        { brand: 'Lee', name: 'Jeans', subcategory: 'Straight' },
        { brand: 'True Religion', name: 'Super T Jeans', subcategory: 'Straight' },
        { brand: 'True Religion', name: 'Billy Jeans', subcategory: 'Bootcut' },
        { brand: 'AG', name: 'Farrah Jeans', subcategory: 'High Rise' },
        { brand: 'AG', name: 'Legging Jeans', subcategory: 'Skinny' },
        { brand: 'Citizens of Humanity', name: 'Rocket Jeans', subcategory: 'Skinny' },
        { brand: 'Citizens of Humanity', name: 'Avedon Jeans', subcategory: 'Skinny' },
        { brand: '7 For All Mankind', name: 'Bootcut Jeans', subcategory: 'Bootcut' },
        { brand: '7 For All Mankind', name: 'Skinny Jeans', subcategory: 'Skinny' },
        { brand: 'Hudson', name: 'Nico Jeans', subcategory: 'Skinny' },
        { brand: 'Hudson', name: 'Beth Jeans', subcategory: 'Bootcut' },
        { brand: "Joe's Jeans", name: 'The Provocateur', subcategory: 'Bootcut' },
        { brand: 'Mother Denim', name: 'The Looker', subcategory: 'Skinny' },
        { brand: 'Frame', name: 'Le High Jeans', subcategory: 'High Rise' },
        { brand: 'Frame', name: 'Le Skinny Jeans', subcategory: 'Skinny' },
        { brand: 'Paige', name: 'Verdugo Jeans', subcategory: 'Skinny' },
        { brand: 'Paige', name: 'Hoxton Jeans', subcategory: 'High Rise' },
        { brand: 'DL1961', name: 'Florence Jeans', subcategory: 'High Rise' },
        { brand: 'Rag & Bone', name: 'Fit 2 Jeans', subcategory: 'Slim' },
        { brand: 'Current/Elliott', name: 'The Stiletto', subcategory: 'Skinny' },
    ],

    'Sneakers': [
        { brand: 'Jordan', name: '1 Chicago', subcategory: 'Jordan 1' },
        { brand: 'Jordan', name: '1 Bred Toe', subcategory: 'Jordan 1' },
        { brand: 'Jordan', name: '1 Royal', subcategory: 'Jordan 1' },
        { brand: 'Jordan', name: '1 Shadow', subcategory: 'Jordan 1' },
        { brand: 'Jordan', name: '1 Mocha', subcategory: 'Jordan 1' },
        { brand: 'Jordan', name: '1 UNC', subcategory: 'Jordan 1' },
        { brand: 'Jordan', name: '1 Pine Green', subcategory: 'Jordan 1' },
        { brand: 'Jordan', name: '3 White Cement', subcategory: 'Jordan 3' },
        { brand: 'Jordan', name: '3 Black Cement', subcategory: 'Jordan 3' },
        { brand: 'Jordan', name: '4 Fire Red', subcategory: 'Jordan 4' },
        { brand: 'Jordan', name: '4 Bred', subcategory: 'Jordan 4' },
        { brand: 'Jordan', name: '4 Military Black', subcategory: 'Jordan 4' },
        { brand: 'Jordan', name: '5 Retro', subcategory: 'Jordan 5' },
        { brand: 'Jordan', name: '11 Concord', subcategory: 'Jordan 11' },
        { brand: 'Jordan', name: '11 Bred', subcategory: 'Jordan 11' },
        { brand: 'Jordan', name: '11 Space Jam', subcategory: 'Jordan 11' },
        { brand: 'Jordan', name: '12 Retro', subcategory: 'Jordan 12' },
        { brand: 'Jordan', name: '13 Retro', subcategory: 'Jordan 13' },
        { brand: 'Yeezy', name: '350 V2 Zebra', subcategory: 'Yeezy 350' },
        { brand: 'Yeezy', name: '350 V2 Beluga', subcategory: 'Yeezy 350' },
        { brand: 'Yeezy', name: '350 V2 Cream', subcategory: 'Yeezy 350' },
        { brand: 'Yeezy', name: '350 V2 Bred', subcategory: 'Yeezy 350' },
        { brand: 'Yeezy', name: '700 Wave Runner', subcategory: 'Yeezy 700' },
        { brand: 'Yeezy', name: 'Slides', subcategory: 'Yeezy Slides' },
        { brand: 'Nike', name: 'Dunk Low Panda', subcategory: 'Dunk Low' },
        { brand: 'Nike', name: 'Dunk Low UNC', subcategory: 'Dunk Low' },
        { brand: 'Nike', name: 'Dunk Low Grey Fog', subcategory: 'Dunk Low' },
        { brand: 'Nike', name: 'Dunk High', subcategory: 'Dunk High' },
        { brand: 'Nike', name: 'Air Max 90', subcategory: 'Air Max' },
        { brand: 'Nike', name: 'Air Max 95', subcategory: 'Air Max' },
        { brand: 'Nike', name: 'Air Max 97', subcategory: 'Air Max' },
        { brand: 'Nike', name: 'Air Max 1', subcategory: 'Air Max' },
        { brand: 'Nike', name: 'Air Force 1 Low', subcategory: 'Air Force 1' },
        { brand: 'Nike', name: 'Air Force 1 High', subcategory: 'Air Force 1' },
        { brand: 'Nike', name: 'SB Dunk', subcategory: 'SB Dunk' },
        { brand: 'New Balance', name: '550', subcategory: 'New Balance' },
        { brand: 'New Balance', name: '990v5', subcategory: 'New Balance' },
        { brand: 'New Balance', name: '2002R', subcategory: 'New Balance' },
        { brand: 'New Balance', name: '574', subcategory: 'New Balance' },
        { brand: 'Adidas', name: 'Samba', subcategory: 'Adidas' },
        { brand: 'Adidas', name: 'Gazelle', subcategory: 'Adidas' },
        { brand: 'Adidas', name: 'Superstar', subcategory: 'Adidas' },
        { brand: 'Adidas', name: 'Stan Smith', subcategory: 'Adidas' },
        { brand: 'Adidas', name: 'Ultra Boost', subcategory: 'Adidas' },
        { brand: 'Converse', name: 'Chuck Taylor All Star', subcategory: 'Converse' },
        { brand: 'Converse', name: 'Chuck 70', subcategory: 'Converse' },
        { brand: 'Vans', name: 'Old Skool', subcategory: 'Vans' },
        { brand: 'Vans', name: 'Sk8-Hi', subcategory: 'Vans' },
        { brand: 'Vans', name: 'Slip-On', subcategory: 'Vans' },
        { brand: 'Asics', name: 'Gel-Lyte III', subcategory: 'Asics' },
        { brand: 'Asics', name: 'Gel-Kayano', subcategory: 'Asics' },
        { brand: 'Salomon', name: 'XT-6', subcategory: 'Trail' },
        { brand: 'Hoka', name: 'Clifton', subcategory: 'Running' },
        { brand: 'Hoka', name: 'Bondi', subcategory: 'Running' },
        { brand: 'On Running', name: 'Cloud', subcategory: 'Running' },
        { brand: 'Birkenstock', name: 'Boston', subcategory: 'Sandals' },
        { brand: 'Birkenstock', name: 'Arizona', subcategory: 'Sandals' },
        { brand: 'Crocs', name: 'Classic Clog', subcategory: 'Clogs' },
        { brand: 'UGG', name: 'Classic Short', subcategory: 'Boots' },
        { brand: 'UGG', name: 'Tasman', subcategory: 'Slippers' },
    ],

    'Handbags & Accessories': [
        { brand: 'Louis Vuitton', name: 'Neverfull', subcategory: 'Totes' },
        { brand: 'Louis Vuitton', name: 'Speedy', subcategory: 'Satchels' },
        { brand: 'Louis Vuitton', name: 'Pochette', subcategory: 'Clutches' },
        { brand: 'Louis Vuitton', name: 'Keepall', subcategory: 'Duffels' },
        { brand: 'Coach', name: 'Tabby Bag', subcategory: 'Shoulder Bags' },
        { brand: 'Coach', name: 'Willow Bag', subcategory: 'Shoulder Bags' },
        { brand: 'Coach', name: 'Court Bag', subcategory: 'Crossbody' },
        { brand: 'Kate Spade', name: 'Tote', subcategory: 'Totes' },
        { brand: 'Kate Spade', name: 'Crossbody', subcategory: 'Crossbody' },
        { brand: 'Kate Spade', name: 'Wallet', subcategory: 'Wallets' },
        { brand: 'Michael Kors', name: 'Jet Set Tote', subcategory: 'Totes' },
        { brand: 'Michael Kors', name: 'Hamilton Satchel', subcategory: 'Satchels' },
        { brand: 'Michael Kors', name: 'Selma Satchel', subcategory: 'Satchels' },
        { brand: 'Tory Burch', name: 'Perry Tote', subcategory: 'Totes' },
        { brand: 'Tory Burch', name: 'Lee Radziwill Bag', subcategory: 'Satchels' },
        { brand: 'Tory Burch', name: 'Wallet', subcategory: 'Wallets' },
        { brand: 'Marc Jacobs', name: 'Snapshot Bag', subcategory: 'Crossbody' },
        { brand: 'Marc Jacobs', name: 'The Tote Bag', subcategory: 'Totes' },
        { brand: 'Dooney & Bourke', name: 'Florentine Bag', subcategory: 'Shoulder Bags' },
        { brand: 'Dooney & Bourke', name: 'Pebble Grain Bag', subcategory: 'Crossbody' },
        { brand: 'Fossil', name: 'Crossbody', subcategory: 'Crossbody' },
        { brand: 'Fossil', name: 'Wallet', subcategory: 'Wallets' },
        { brand: 'Longchamp', name: 'Le Pliage', subcategory: 'Totes' },
        { brand: 'Gucci', name: 'Marmont Bag', subcategory: 'Shoulder Bags' },
        { brand: 'Gucci', name: 'Dionysus Bag', subcategory: 'Shoulder Bags' },
        { brand: 'Gucci', name: 'Jackie Bag', subcategory: 'Hobo Bags' },
        { brand: 'Prada', name: 'Re-Edition Bag', subcategory: 'Shoulder Bags' },
        { brand: 'Prada', name: 'Galleria Bag', subcategory: 'Satchels' },
        { brand: 'Chanel', name: 'Classic Flap', subcategory: 'Shoulder Bags' },
        { brand: 'Chanel', name: 'Boy Bag', subcategory: 'Shoulder Bags' },
        { brand: 'Chanel', name: 'WOC', subcategory: 'Clutches' },
        { brand: 'Celine', name: 'Luggage Tote', subcategory: 'Totes' },
        { brand: 'Celine', name: 'Belt Bag', subcategory: 'Crossbody' },
        { brand: 'Fendi', name: 'Baguette', subcategory: 'Shoulder Bags' },
        { brand: 'Fendi', name: 'Peekaboo', subcategory: 'Satchels' },
        { brand: 'Saint Laurent', name: 'Loulou Bag', subcategory: 'Shoulder Bags' },
        { brand: 'Saint Laurent', name: 'Kate Bag', subcategory: 'Clutches' },
        { brand: 'Burberry', name: 'TB Bag', subcategory: 'Shoulder Bags' },
        { brand: 'Burberry', name: 'Check Scarf', subcategory: 'Scarves' },
        { brand: 'Goyard', name: 'St. Louis Tote', subcategory: 'Totes' },
        { brand: 'Bottega Veneta', name: 'The Pouch', subcategory: 'Clutches' },
        { brand: 'Bottega Veneta', name: 'Cassette Bag', subcategory: 'Shoulder Bags' },
        { brand: 'Hermes', name: 'Birkin', subcategory: 'Satchels' },
        { brand: 'Hermes', name: 'Kelly', subcategory: 'Satchels' },
        { brand: 'Hermes', name: 'Garden Party', subcategory: 'Totes' },
        { brand: 'MCM', name: 'Stark Backpack', subcategory: 'Backpacks' },
    ],

    'Activewear': [
        { brand: 'Lululemon', name: 'Align Leggings', subcategory: 'Bottoms' },
        { brand: 'Lululemon', name: 'Wunder Under Leggings', subcategory: 'Bottoms' },
        { brand: 'Lululemon', name: 'Define Jacket', subcategory: 'Jackets' },
        { brand: 'Lululemon', name: 'Scuba Hoodie', subcategory: 'Hoodies' },
        { brand: 'Lululemon', name: 'Hotty Hot Shorts', subcategory: 'Bottoms' },
        { brand: 'Lululemon', name: 'Energy Bra', subcategory: 'Tops' },
        { brand: 'Lululemon', name: 'Swiftly Tech Tee', subcategory: 'Tops' },
        { brand: 'Nike', name: 'Pro Leggings', subcategory: 'Bottoms' },
        { brand: 'Nike', name: 'Dri-FIT Top', subcategory: 'Tops' },
        { brand: 'Nike', name: 'Tech Fleece Hoodie', subcategory: 'Hoodies' },
        { brand: 'Nike', name: 'Tech Fleece Jogger', subcategory: 'Bottoms' },
        { brand: 'Adidas', name: 'Tiro Pants', subcategory: 'Bottoms' },
        { brand: 'Adidas', name: 'Track Jacket', subcategory: 'Jackets' },
        { brand: 'Under Armour', name: 'Leggings', subcategory: 'Bottoms' },
        { brand: 'Under Armour', name: 'Hoodie', subcategory: 'Hoodies' },
        { brand: 'Alo Yoga', name: 'Airlift Leggings', subcategory: 'Bottoms' },
        { brand: 'Alo Yoga', name: 'High-Waist Leggings', subcategory: 'Bottoms' },
        { brand: 'Alo Yoga', name: 'Sports Bra', subcategory: 'Tops' },
        { brand: 'Athleta', name: 'Elation Leggings', subcategory: 'Bottoms' },
        { brand: 'Athleta', name: 'Salutation Tights', subcategory: 'Bottoms' },
        { brand: 'Outdoor Voices', name: 'Exercise Dress', subcategory: 'Dresses' },
        { brand: 'Outdoor Voices', name: 'TechSweat Hoodie', subcategory: 'Hoodies' },
        { brand: 'Vuori', name: 'Performance Jogger', subcategory: 'Bottoms' },
        { brand: 'Vuori', name: 'Ponto Pants', subcategory: 'Bottoms' },
        { brand: 'Gymshark', name: 'Leggings', subcategory: 'Bottoms' },
        { brand: 'Gymshark', name: 'Sports Bra', subcategory: 'Tops' },
        { brand: 'Fabletics', name: 'Leggings', subcategory: 'Bottoms' },
        { brand: 'Fabletics', name: 'Outfit Set', subcategory: 'Sets' },
    ],

    'Outerwear': [
        { brand: 'Patagonia', name: 'Better Sweater Fleece', subcategory: 'Fleece' },
        { brand: 'Patagonia', name: 'Nano Puff Jacket', subcategory: 'Puffer' },
        { brand: 'Patagonia', name: 'Retro-X Fleece', subcategory: 'Fleece' },
        { brand: 'Patagonia', name: 'Down Sweater', subcategory: 'Puffer' },
        { brand: 'Patagonia', name: 'Torrentshell Jacket', subcategory: 'Rain Jackets' },
        { brand: 'The North Face', name: 'Nuptse Puffer', subcategory: 'Puffer' },
        { brand: 'The North Face', name: 'Denali Fleece', subcategory: 'Fleece' },
        { brand: 'The North Face', name: 'Thermoball Jacket', subcategory: 'Puffer' },
        { brand: 'The North Face', name: 'Osito Fleece', subcategory: 'Fleece' },
        { brand: 'Columbia', name: 'Bugaboo Jacket', subcategory: 'Puffer' },
        { brand: 'Columbia', name: 'Omni-Heat Jacket', subcategory: 'Puffer' },
        { brand: "Arc'teryx", name: 'Atom Jacket', subcategory: 'Puffer' },
        { brand: "Arc'teryx", name: 'Beta Jacket', subcategory: 'Shell' },
        { brand: "Arc'teryx", name: 'Cerium Jacket', subcategory: 'Puffer' },
        { brand: 'Canada Goose', name: 'Expedition Parka', subcategory: 'Parka' },
        { brand: 'Canada Goose', name: 'Chilliwack Bomber', subcategory: 'Bomber' },
        { brand: 'Moncler', name: 'Maya Jacket', subcategory: 'Puffer' },
        { brand: 'Moncler', name: 'Hermine Jacket', subcategory: 'Puffer' },
        { brand: 'Barbour', name: 'Bedale Jacket', subcategory: 'Waxed Cotton' },
        { brand: 'Barbour', name: 'Beaufort Jacket', subcategory: 'Waxed Cotton' },
        { brand: 'Carhartt', name: 'Detroit Jacket', subcategory: 'Work Jackets' },
        { brand: 'Carhartt', name: 'Active Jacket', subcategory: 'Work Jackets' },
        { brand: "Levi's", name: 'Trucker Jacket', subcategory: 'Denim Jackets' },
        { brand: 'Schott', name: 'Perfecto Leather Jacket', subcategory: 'Leather' },
        { brand: 'Dr. Martens', name: '1460 Boots', subcategory: 'Boots' },
        { brand: 'Dr. Martens', name: 'Jadon Platform Boots', subcategory: 'Boots' },
        { brand: 'Dr. Martens', name: 'Platform Boots', subcategory: 'Boots' },
    ],

    'Electronics': [
        { brand: 'Apple', name: 'iPhone 13', subcategory: 'Smartphones' },
        { brand: 'Apple', name: 'iPhone 13 Pro', subcategory: 'Smartphones' },
        { brand: 'Apple', name: 'iPhone 13 Pro Max', subcategory: 'Smartphones' },
        { brand: 'Apple', name: 'iPhone 14', subcategory: 'Smartphones' },
        { brand: 'Apple', name: 'iPhone 14 Pro', subcategory: 'Smartphones' },
        { brand: 'Apple', name: 'iPhone 14 Pro Max', subcategory: 'Smartphones' },
        { brand: 'Apple', name: 'iPhone 15', subcategory: 'Smartphones' },
        { brand: 'Apple', name: 'iPhone 15 Pro', subcategory: 'Smartphones' },
        { brand: 'Apple', name: 'iPhone 15 Pro Max', subcategory: 'Smartphones' },
        { brand: 'Apple', name: 'iPhone 16', subcategory: 'Smartphones' },
        { brand: 'Apple', name: 'iPhone 16 Pro', subcategory: 'Smartphones' },
        { brand: 'Apple', name: 'iPhone 16 Pro Max', subcategory: 'Smartphones' },
        { brand: 'Samsung', name: 'Galaxy S23', subcategory: 'Smartphones' },
        { brand: 'Samsung', name: 'Galaxy S24', subcategory: 'Smartphones' },
        { brand: 'Samsung', name: 'Galaxy Z Flip', subcategory: 'Smartphones' },
        { brand: 'Samsung', name: 'Galaxy Z Fold', subcategory: 'Smartphones' },
        { brand: 'Apple', name: 'iPad Air', subcategory: 'Tablets' },
        { brand: 'Apple', name: 'iPad Pro', subcategory: 'Tablets' },
        { brand: 'Apple', name: 'iPad Mini', subcategory: 'Tablets' },
        { brand: 'Apple', name: 'MacBook Air M1', subcategory: 'Laptops' },
        { brand: 'Apple', name: 'MacBook Air M2', subcategory: 'Laptops' },
        { brand: 'Apple', name: 'MacBook Pro 14', subcategory: 'Laptops' },
        { brand: 'Apple', name: 'MacBook Pro 16', subcategory: 'Laptops' },
        { brand: 'Apple', name: 'AirPods Pro 2', subcategory: 'Audio' },
        { brand: 'Apple', name: 'AirPods Max', subcategory: 'Audio' },
        { brand: 'Apple', name: 'AirPods 3rd Gen', subcategory: 'Audio' },
        { brand: 'Apple', name: 'Apple Watch Series 8', subcategory: 'Smartwatches' },
        { brand: 'Apple', name: 'Apple Watch Series 9', subcategory: 'Smartwatches' },
        { brand: 'Apple', name: 'Apple Watch Ultra', subcategory: 'Smartwatches' },
        { brand: 'Nintendo', name: 'Switch OLED', subcategory: 'Gaming Consoles' },
        { brand: 'Nintendo', name: 'Switch Lite', subcategory: 'Gaming Consoles' },
        { brand: 'Sony', name: 'PS5 Disc Edition', subcategory: 'Gaming Consoles' },
        { brand: 'Sony', name: 'PS5 Digital Edition', subcategory: 'Gaming Consoles' },
        { brand: 'Microsoft', name: 'Xbox Series X', subcategory: 'Gaming Consoles' },
        { brand: 'Microsoft', name: 'Xbox Series S', subcategory: 'Gaming Consoles' },
        { brand: 'Valve', name: 'Steam Deck', subcategory: 'Gaming Consoles' },
        { brand: 'Meta', name: 'Quest 3', subcategory: 'VR Headsets' },
        { brand: 'Amazon', name: 'Kindle Paperwhite', subcategory: 'E-Readers' },
        { brand: 'Amazon', name: 'Kindle Oasis', subcategory: 'E-Readers' },
        { brand: 'Dyson', name: 'V15 Vacuum', subcategory: 'Vacuums' },
        { brand: 'Dyson', name: 'Airwrap', subcategory: 'Hair Tools' },
        { brand: 'Dyson', name: 'Supersonic Hair Dryer', subcategory: 'Hair Tools' },
        { brand: 'Bose', name: 'QuietComfort 45', subcategory: 'Audio' },
        { brand: 'Bose', name: '700 Headphones', subcategory: 'Audio' },
        { brand: 'Bose', name: 'SoundLink Speaker', subcategory: 'Audio' },
        { brand: 'Sony', name: 'WH-1000XM5', subcategory: 'Audio' },
        { brand: 'Sony', name: 'WF-1000XM5', subcategory: 'Audio' },
        { brand: 'Canon', name: 'EOS R Camera', subcategory: 'Cameras' },
        { brand: 'Canon', name: 'Rebel T7', subcategory: 'Cameras' },
        { brand: 'Sony', name: 'Alpha A7 III', subcategory: 'Cameras' },
        { brand: 'Sony', name: 'Alpha A6000', subcategory: 'Cameras' },
        { brand: 'GoPro', name: 'Hero 12', subcategory: 'Action Cameras' },
        { brand: 'DJI', name: 'Mini 4 Drone', subcategory: 'Drones' },
        { brand: 'DJI', name: 'Mavic 3 Drone', subcategory: 'Drones' },
        { brand: 'iRobot', name: 'Roomba i7', subcategory: 'Robot Vacuums' },
        { brand: 'iRobot', name: 'Roomba j7', subcategory: 'Robot Vacuums' },
        { brand: 'iRobot', name: 'Roomba s9', subcategory: 'Robot Vacuums' },
    ],

    'Kitchen & Home Appliances': [
        { brand: 'KitchenAid', name: 'Stand Mixer', subcategory: 'Mixers' },
        { brand: 'KitchenAid', name: 'Artisan Mixer', subcategory: 'Mixers' },
        { brand: 'Vitamix', name: 'Blender', subcategory: 'Blenders' },
        { brand: 'Instant Pot', name: 'Duo', subcategory: 'Pressure Cookers' },
        { brand: 'Instant Pot', name: 'Ultra', subcategory: 'Pressure Cookers' },
        { brand: 'Ninja', name: 'Blender', subcategory: 'Blenders' },
        { brand: 'Ninja', name: 'Creami', subcategory: 'Ice Cream Makers' },
        { brand: 'Ninja', name: 'Foodi Air Fryer', subcategory: 'Air Fryers' },
        { brand: 'Nespresso', name: 'Coffee Machine', subcategory: 'Coffee Makers' },
        { brand: 'Breville', name: 'Barista Express', subcategory: 'Espresso Machines' },
        { brand: 'Breville', name: 'Smart Oven', subcategory: 'Toaster Ovens' },
        { brand: 'Le Creuset', name: 'Dutch Oven', subcategory: 'Cookware' },
        { brand: 'Le Creuset', name: 'Skillet', subcategory: 'Cookware' },
        { brand: 'Le Creuset', name: 'Braiser', subcategory: 'Cookware' },
        { brand: 'Staub', name: 'Cocotte Dutch Oven', subcategory: 'Cookware' },
        { brand: 'Staub', name: 'Braiser', subcategory: 'Cookware' },
        { brand: 'All-Clad', name: 'D3 Cookware Set', subcategory: 'Cookware' },
        { brand: 'All-Clad', name: 'D5 Cookware', subcategory: 'Cookware' },
        { brand: 'All-Clad', name: 'Copper Core Pan', subcategory: 'Cookware' },
        { brand: 'Lodge', name: 'Cast Iron Skillet', subcategory: 'Cookware' },
        { brand: 'Lodge', name: 'Cast Iron Dutch Oven', subcategory: 'Cookware' },
        { brand: 'Cuisinart', name: 'Food Processor', subcategory: 'Food Processors' },
        { brand: 'Cuisinart', name: 'Coffee Maker', subcategory: 'Coffee Makers' },
    ],

    'Vintage Kitchen & Glass': [
        { brand: 'Pyrex', name: 'Friendship Pattern', subcategory: 'Casseroles' },
        { brand: 'Pyrex', name: 'Butterfly Gold Pattern', subcategory: 'Casseroles' },
        { brand: 'Pyrex', name: 'Spring Blossom Pattern', subcategory: 'Casseroles' },
        { brand: 'Pyrex', name: 'Gooseberry Pattern', subcategory: 'Casseroles' },
        { brand: 'Pyrex', name: 'Primary Colors Mixing Bowls', subcategory: 'Mixing Bowls' },
        { brand: 'CorningWare', name: 'Cornflower Pattern', subcategory: 'Casseroles' },
        { brand: 'CorningWare', name: 'Spice of Life Pattern', subcategory: 'Casseroles' },
        { brand: 'Fiesta Ware', name: 'Vintage Colors Dinnerware', subcategory: 'Dinnerware' },
        { brand: 'Fiesta Ware', name: 'Contemporary Dinnerware', subcategory: 'Dinnerware' },
        { brand: 'Depression Glass', name: 'Royal Lace Pattern', subcategory: 'Depression Glass' },
        { brand: 'Depression Glass', name: 'Princess Pattern', subcategory: 'Depression Glass' },
        { brand: 'Depression Glass', name: 'Miss America Pattern', subcategory: 'Depression Glass' },
        { brand: 'Carnival Glass', name: 'Northwood Carnival Glass', subcategory: 'Carnival Glass' },
        { brand: 'Carnival Glass', name: 'Fenton Carnival Glass', subcategory: 'Carnival Glass' },
        { brand: 'Milk Glass', name: 'Westmoreland Milk Glass', subcategory: 'Milk Glass' },
        { brand: 'Milk Glass', name: 'Fenton Milk Glass', subcategory: 'Milk Glass' },
        { brand: 'Milk Glass', name: 'Anchor Hocking Milk Glass', subcategory: 'Milk Glass' },
        { brand: 'Fire-King', name: 'Jadeite Glassware', subcategory: 'Jadeite' },
        { brand: 'Fire-King', name: 'Sapphire Blue Glassware', subcategory: 'Sapphire' },
        { brand: 'Vintage Tupperware', name: 'Servalier Bowl Set', subcategory: 'Tupperware' },
        { brand: 'Vintage Tupperware', name: 'Thatsa Bowl', subcategory: 'Tupperware' },
    ],

    'Furniture': [
        { brand: 'Herman Miller', name: 'Aeron Chair', subcategory: 'Chairs' },
        { brand: 'Herman Miller', name: 'Eames Lounge Chair', subcategory: 'Chairs' },
        { brand: 'Herman Miller', name: 'Nelson Bench', subcategory: 'Benches' },
        { brand: 'Knoll', name: 'Womb Chair', subcategory: 'Chairs' },
        { brand: 'Knoll', name: 'Barcelona Chair', subcategory: 'Chairs' },
        { brand: 'West Elm', name: 'Mid-Century Desk', subcategory: 'Desks' },
        { brand: 'West Elm', name: 'Sofa', subcategory: 'Sofas' },
        { brand: 'Pottery Barn', name: 'Comfort Sofa', subcategory: 'Sofas' },
        { brand: 'Pottery Barn', name: 'York Sofa', subcategory: 'Sofas' },
        { brand: 'CB2', name: 'Avec Sofa', subcategory: 'Sofas' },
        { brand: 'CB2', name: 'Gwyneth Chair', subcategory: 'Chairs' },
        { brand: 'Room & Board', name: 'Jasper Sofa', subcategory: 'Sofas' },
        { brand: 'Room & Board', name: 'Andre Chair', subcategory: 'Chairs' },
        { brand: 'IKEA', name: 'Kallax Shelf', subcategory: 'Shelving' },
        { brand: 'IKEA', name: 'Billy Bookcase', subcategory: 'Bookshelves' },
        { brand: 'IKEA', name: 'Poäng Chair', subcategory: 'Chairs' },
        { brand: 'IKEA', name: 'Malm Dresser', subcategory: 'Dressers' },
        { brand: 'Restoration Hardware', name: 'Cloud Sofa', subcategory: 'Sofas' },
        { brand: 'Restoration Hardware', name: 'Lancaster Chair', subcategory: 'Chairs' },
        { brand: 'Crate & Barrel', name: 'Lounge II Sofa', subcategory: 'Sofas' },
        { brand: 'Vintage MCM', name: 'Teak Credenza', subcategory: 'Mid-Century Modern' },
        { brand: 'Vintage MCM', name: 'Danish Chair', subcategory: 'Mid-Century Modern' },
        { brand: 'Vintage MCM', name: 'Walnut Dresser', subcategory: 'Mid-Century Modern' },
        { brand: 'Stickley', name: 'Mission Oak Furniture', subcategory: 'Mission' },
    ],

    'Watches': [
        { brand: 'Apple', name: 'Watch Series 8', subcategory: 'Smartwatches' },
        { brand: 'Apple', name: 'Watch Series 9', subcategory: 'Smartwatches' },
        { brand: 'Apple', name: 'Watch Ultra', subcategory: 'Smartwatches' },
        { brand: 'Garmin', name: 'Fenix Watch', subcategory: 'GPS Watches' },
        { brand: 'Garmin', name: 'Forerunner Watch', subcategory: 'GPS Watches' },
        { brand: 'Garmin', name: 'Venu Smartwatch', subcategory: 'Smartwatches' },
        { brand: 'Fitbit', name: 'Versa Watch', subcategory: 'Fitness Trackers' },
        { brand: 'Fitbit', name: 'Charge Tracker', subcategory: 'Fitness Trackers' },
        { brand: 'Fitbit', name: 'Sense Watch', subcategory: 'Fitness Trackers' },
        { brand: 'Casio', name: 'G-Shock DW-5600', subcategory: 'G-Shock' },
        { brand: 'Casio', name: 'G-Shock GA-2100', subcategory: 'G-Shock' },
        { brand: 'Seiko', name: 'Presage Watch', subcategory: 'Dress Watches' },
        { brand: 'Seiko', name: 'Prospex Watch', subcategory: 'Sport Watches' },
        { brand: 'Seiko', name: '5 Sports Watch', subcategory: 'Sport Watches' },
        { brand: 'Citizen', name: 'Eco-Drive Watch', subcategory: 'Dress Watches' },
        { brand: 'Citizen', name: 'Promaster Watch', subcategory: 'Sport Watches' },
        { brand: 'Timex', name: 'Weekender Watch', subcategory: 'Casual Watches' },
        { brand: 'Timex', name: 'Expedition Watch', subcategory: 'Outdoor Watches' },
        { brand: 'Timex', name: 'Marlin Watch', subcategory: 'Dress Watches' },
        { brand: 'Samsung', name: 'Galaxy Watch', subcategory: 'Smartwatches' },
    ],

    'Jewelry': [
        { brand: 'Tiffany & Co', name: 'Return To Tiffany Necklace', subcategory: 'Necklaces' },
        { brand: 'Tiffany & Co', name: 'Heart Tag Bracelet', subcategory: 'Bracelets' },
        { brand: 'Tiffany & Co', name: 'Elsa Peretti Collection', subcategory: 'Designer' },
        { brand: 'Pandora', name: 'Charm Bracelet', subcategory: 'Bracelets' },
        { brand: 'Pandora', name: 'Moments Bracelet', subcategory: 'Bracelets' },
        { brand: 'Pandora', name: 'Ring', subcategory: 'Rings' },
        { brand: 'David Yurman', name: 'Cable Bracelet', subcategory: 'Bracelets' },
        { brand: 'David Yurman', name: 'Crossover Ring', subcategory: 'Rings' },
        { brand: 'Kendra Scott', name: 'Elisa Necklace', subcategory: 'Necklaces' },
        { brand: 'Kendra Scott', name: 'Lee Earrings', subcategory: 'Earrings' },
        { brand: 'Kendra Scott', name: 'Danielle Earrings', subcategory: 'Earrings' },
        { brand: 'James Avery', name: 'Charm', subcategory: 'Charms' },
        { brand: 'James Avery', name: 'Ring', subcategory: 'Rings' },
        { brand: 'Brighton', name: 'Bracelet', subcategory: 'Bracelets' },
        { brand: 'Brighton', name: 'Necklace', subcategory: 'Necklaces' },
        { brand: 'Vintage Sterling Silver', name: 'Sterling Silver Jewelry', subcategory: 'Vintage' },
        { brand: 'Vintage Gold-Filled', name: 'Gold-Filled Jewelry', subcategory: 'Vintage' },
        { brand: 'Costume Jewelry Monet', name: 'Monet Jewelry', subcategory: 'Costume' },
        { brand: 'Costume Jewelry Napier', name: 'Napier Jewelry', subcategory: 'Costume' },
        { brand: 'Costume Jewelry Trifari', name: 'Trifari Jewelry', subcategory: 'Costume' },
        { brand: 'Sarah Coventry', name: 'Vintage Jewelry', subcategory: 'Costume' },
    ],

    'Toys & Games': [
        { brand: 'LEGO', name: 'Star Wars Set', subcategory: 'LEGO' },
        { brand: 'LEGO', name: 'Technic Set', subcategory: 'LEGO' },
        { brand: 'LEGO', name: 'Architecture Set', subcategory: 'LEGO' },
        { brand: 'LEGO', name: 'City Set', subcategory: 'LEGO' },
        { brand: 'Funko Pop', name: 'Marvel Figure', subcategory: 'Funko Pop' },
        { brand: 'Funko Pop', name: 'Disney Figure', subcategory: 'Funko Pop' },
        { brand: 'Funko Pop', name: 'Anime Figure', subcategory: 'Funko Pop' },
        { brand: 'Hot Wheels', name: 'Treasure Hunt Car', subcategory: 'Die-Cast' },
        { brand: 'Hot Wheels', name: 'Premium Car', subcategory: 'Die-Cast' },
        { brand: 'Barbie', name: 'Collector Doll', subcategory: 'Dolls' },
        { brand: 'Barbie', name: 'Holiday Doll', subcategory: 'Dolls' },
        { brand: 'Barbie', name: 'Fashionista Doll', subcategory: 'Dolls' },
        { brand: 'American Girl', name: 'Doll', subcategory: 'Dolls' },
        { brand: 'Pokemon', name: 'Charizard Card', subcategory: 'Trading Cards' },
        { brand: 'Pokemon', name: 'Booster Box', subcategory: 'Trading Cards' },
        { brand: 'Pokemon', name: 'Elite Trainer Box', subcategory: 'Trading Cards' },
        { brand: 'Magic: The Gathering', name: 'Commander Deck', subcategory: 'Trading Cards' },
        { brand: 'Magic: The Gathering', name: 'Booster Box', subcategory: 'Trading Cards' },
        { brand: 'Nintendo', name: 'Zelda Game', subcategory: 'Video Games' },
        { brand: 'Nintendo', name: 'Mario Game', subcategory: 'Video Games' },
        { brand: 'Nintendo', name: 'Pokemon Game', subcategory: 'Video Games' },
        { brand: 'PlayStation', name: 'Video Game', subcategory: 'Video Games' },
        { brand: 'Settlers of Catan', name: 'Board Game', subcategory: 'Board Games' },
        { brand: 'Ticket to Ride', name: 'Board Game', subcategory: 'Board Games' },
        { brand: 'Gloomhaven', name: 'Board Game', subcategory: 'Board Games' },
        { brand: 'Vintage Star Wars', name: 'Kenner Action Figure', subcategory: 'Vintage Toys' },
        { brand: 'Beanie Babies', name: 'Princess Bear', subcategory: 'Beanie Babies' },
        { brand: 'Beanie Babies', name: 'Peace Bear', subcategory: 'Beanie Babies' },
        { brand: 'Beanie Babies', name: 'Valentino Bear', subcategory: 'Beanie Babies' },
    ],

    'Sports Equipment': [
        { brand: 'Titleist', name: 'Pro V1 Golf Balls', subcategory: 'Golf' },
        { brand: 'Titleist', name: 'TSR Driver', subcategory: 'Golf' },
        { brand: 'Titleist', name: 'Vokey Wedge', subcategory: 'Golf' },
        { brand: 'Callaway', name: 'Paradym Driver', subcategory: 'Golf' },
        { brand: 'Callaway', name: 'Chrome Soft Golf Balls', subcategory: 'Golf' },
        { brand: 'TaylorMade', name: 'Stealth Driver', subcategory: 'Golf' },
        { brand: 'TaylorMade', name: 'Spider Putter', subcategory: 'Golf' },
        { brand: 'Ping', name: 'G430 Irons', subcategory: 'Golf' },
        { brand: 'Ping', name: 'Anser Putter', subcategory: 'Golf' },
        { brand: 'Peloton', name: 'Bike', subcategory: 'Fitness Equipment' },
        { brand: 'Peloton', name: 'Bike+', subcategory: 'Fitness Equipment' },
        { brand: 'Peloton', name: 'Tread', subcategory: 'Fitness Equipment' },
        { brand: 'Yeti', name: 'Rambler Tumbler', subcategory: 'Drinkware' },
        { brand: 'Yeti', name: 'Tundra Cooler', subcategory: 'Coolers' },
        { brand: 'Yeti', name: 'Hopper Cooler', subcategory: 'Coolers' },
        { brand: 'Hydro Flask', name: '32oz Water Bottle', subcategory: 'Drinkware' },
        { brand: 'Hydro Flask', name: '40oz Water Bottle', subcategory: 'Drinkware' },
        { brand: 'Wilson', name: 'Tennis Racket', subcategory: 'Tennis' },
        { brand: 'Wilson', name: 'Basketball', subcategory: 'Basketball' },
        { brand: 'Rawlings', name: 'Baseball Glove', subcategory: 'Baseball' },
        { brand: 'DeMarini', name: 'Baseball Bat', subcategory: 'Baseball' },
    ],

    'Books & Media': [
        { brand: 'First Edition', name: 'Harry Potter Book', subcategory: 'Books' },
        { brand: 'First Edition', name: 'Lord of the Rings Book', subcategory: 'Books' },
        { brand: 'First Edition', name: 'To Kill a Mockingbird', subcategory: 'Books' },
        { brand: 'Signed Books', name: 'Author Signed Book', subcategory: 'Books' },
        { brand: 'Vintage Vinyl', name: 'Beatles Record', subcategory: 'Vinyl' },
        { brand: 'Vintage Vinyl', name: 'Pink Floyd Record', subcategory: 'Vinyl' },
        { brand: 'Vintage Vinyl', name: 'Led Zeppelin Record', subcategory: 'Vinyl' },
        { brand: 'Vintage Vinyl', name: 'Miles Davis Record', subcategory: 'Vinyl' },
        { brand: 'VHS', name: 'Disney Black Diamond VHS', subcategory: 'VHS' },
        { brand: 'Retro Video Games', name: 'NES Game Sealed', subcategory: 'Video Games' },
        { brand: 'Retro Video Games', name: 'SNES Game Sealed', subcategory: 'Video Games' },
        { brand: 'Retro Video Games', name: 'N64 Game Sealed', subcategory: 'Video Games' },
        { brand: 'Retro Video Games', name: 'PS1 Game Sealed', subcategory: 'Video Games' },
        { brand: 'Criterion Collection', name: 'Blu-ray Box Set', subcategory: 'Movies' },
        { brand: 'Manga', name: 'Berserk Complete Set', subcategory: 'Manga' },
        { brand: 'Manga', name: 'One Piece Set', subcategory: 'Manga' },
        { brand: 'Manga', name: 'Naruto Complete Set', subcategory: 'Manga' },
        { brand: 'Comic Books', name: 'Amazing Spider-Man Key Issue', subcategory: 'Comics' },
        { brand: 'Comic Books', name: 'X-Men Key Issue', subcategory: 'Comics' },
        { brand: 'Comic Books', name: 'Batman Key Issue', subcategory: 'Comics' },
    ],

    'Art & Decor': [
        { brand: 'Vintage Prints', name: 'Ansel Adams Print', subcategory: 'Photography' },
        { brand: 'Vintage Prints', name: 'Mucha Art Nouveau Print', subcategory: 'Prints' },
        { brand: 'McCoy Pottery', name: 'McCoy Vase', subcategory: 'Pottery' },
        { brand: 'Roseville Pottery', name: 'Roseville Vase', subcategory: 'Pottery' },
        { brand: 'Weller Pottery', name: 'Weller Vase', subcategory: 'Pottery' },
        { brand: 'Van Briggle Pottery', name: 'Van Briggle Piece', subcategory: 'Pottery' },
        { brand: 'Rookwood Pottery', name: 'Rookwood Piece', subcategory: 'Pottery' },
        { brand: 'Vintage Signs', name: 'Neon Sign', subcategory: 'Signs' },
        { brand: 'Vintage Signs', name: 'Porcelain Sign', subcategory: 'Signs' },
        { brand: 'Vintage Signs', name: 'Tin Sign', subcategory: 'Signs' },
        { brand: 'Tiffany-Style', name: 'Tiffany-Style Lamp', subcategory: 'Lighting' },
        { brand: 'Vintage Maps', name: 'Antique Map', subcategory: 'Maps' },
        { brand: 'Vintage Movie Posters', name: 'Movie Poster', subcategory: 'Posters' },
        { brand: 'Mid-Century Art', name: 'Mid-Century Wall Art', subcategory: 'Wall Art' },
        { brand: 'Vintage Clocks', name: 'Sunburst Clock', subcategory: 'Clocks' },
        { brand: 'Vintage Clocks', name: 'Kit-Cat Clock', subcategory: 'Clocks' },
        { brand: 'Sculpture', name: 'Bronze Sculpture', subcategory: 'Sculpture' },
        { brand: 'Sculpture', name: 'Marble Sculpture', subcategory: 'Sculpture' },
        { brand: 'Sculpture', name: 'Ceramic Sculpture', subcategory: 'Sculpture' },
    ],

    'Cameras & Photo': [
        { brand: 'Canon', name: 'EOS R5', subcategory: 'Mirrorless' },
        { brand: 'Canon', name: 'EOS R6', subcategory: 'Mirrorless' },
        { brand: 'Canon', name: 'Rebel T7', subcategory: 'DSLR' },
        { brand: 'Canon', name: '5D Mark IV', subcategory: 'DSLR' },
        { brand: 'Sony', name: 'Alpha A7 III', subcategory: 'Mirrorless' },
        { brand: 'Sony', name: 'Alpha A7 IV', subcategory: 'Mirrorless' },
        { brand: 'Sony', name: 'Alpha A6000', subcategory: 'Mirrorless' },
        { brand: 'Sony', name: 'Alpha A6400', subcategory: 'Mirrorless' },
        { brand: 'Nikon', name: 'Z6 Camera', subcategory: 'Mirrorless' },
        { brand: 'Nikon', name: 'Z7 Camera', subcategory: 'Mirrorless' },
        { brand: 'Nikon', name: 'D850 Camera', subcategory: 'DSLR' },
        { brand: 'Fujifilm', name: 'X-T5 Camera', subcategory: 'Mirrorless' },
        { brand: 'Fujifilm', name: 'X100V Camera', subcategory: 'Compact' },
        { brand: 'Fujifilm', name: 'Instax Camera', subcategory: 'Instant' },
        { brand: 'GoPro', name: 'Hero 12', subcategory: 'Action Camera' },
        { brand: 'GoPro', name: 'Hero 11', subcategory: 'Action Camera' },
        { brand: 'Polaroid', name: 'Now Camera', subcategory: 'Instant' },
        { brand: 'Polaroid', name: 'Vintage SX-70', subcategory: 'Vintage' },
        { brand: 'Leica', name: 'Q2 Camera', subcategory: 'Compact' },
        { brand: 'DJI', name: 'Osmo Pocket', subcategory: 'Action Camera' },
    ],

    'Musical Instruments': [
        { brand: 'Fender', name: 'Stratocaster Guitar', subcategory: 'Electric Guitars' },
        { brand: 'Fender', name: 'Telecaster Guitar', subcategory: 'Electric Guitars' },
        { brand: 'Fender', name: 'Jazz Bass', subcategory: 'Bass Guitars' },
        { brand: 'Fender', name: 'Precision Bass', subcategory: 'Bass Guitars' },
        { brand: 'Gibson', name: 'Les Paul Guitar', subcategory: 'Electric Guitars' },
        { brand: 'Gibson', name: 'SG Guitar', subcategory: 'Electric Guitars' },
        { brand: 'Gibson', name: 'ES-335 Guitar', subcategory: 'Electric Guitars' },
        { brand: 'Yamaha', name: 'Acoustic Guitar', subcategory: 'Acoustic Guitars' },
        { brand: 'Yamaha', name: 'Keyboard', subcategory: 'Keyboards' },
        { brand: 'Yamaha', name: 'Trumpet', subcategory: 'Brass' },
        { brand: 'Roland', name: 'Synthesizer', subcategory: 'Synthesizers' },
        { brand: 'Roland', name: 'Electronic Drums', subcategory: 'Drums' },
        { brand: 'Shure', name: 'SM58 Microphone', subcategory: 'Microphones' },
        { brand: 'Shure', name: 'SM7B Microphone', subcategory: 'Microphones' },
        { brand: 'Audio-Technica', name: 'AT2020 Microphone', subcategory: 'Microphones' },
        { brand: 'Audio-Technica', name: 'ATH-M50x Headphones', subcategory: 'Headphones' },
        { brand: 'Pioneer', name: 'DJ Controller', subcategory: 'DJ Equipment' },
        { brand: 'Selmer', name: 'Saxophone', subcategory: 'Woodwinds' },
        { brand: 'Bach', name: 'Trumpet', subcategory: 'Brass' },
        { brand: 'Pearl', name: 'Drum Kit', subcategory: 'Drums' },
    ],

    'Baby & Kids': [
        { brand: 'UPPAbaby', name: 'Vista Stroller', subcategory: 'Strollers' },
        { brand: 'UPPAbaby', name: 'Cruz Stroller', subcategory: 'Strollers' },
        { brand: 'UPPAbaby', name: 'Mesa Car Seat', subcategory: 'Car Seats' },
        { brand: 'Bugaboo', name: 'Fox Stroller', subcategory: 'Strollers' },
        { brand: 'Bugaboo', name: 'Cameleon Stroller', subcategory: 'Strollers' },
        { brand: 'Bugaboo', name: 'Bee Stroller', subcategory: 'Strollers' },
        { brand: 'Baby Jogger', name: 'City Mini Stroller', subcategory: 'Strollers' },
        { brand: 'Doona', name: 'Car Seat Stroller', subcategory: 'Car Seats' },
        { brand: 'Nuna', name: 'Rava Car Seat', subcategory: 'Car Seats' },
        { brand: 'Nuna', name: 'Pipa Car Seat', subcategory: 'Car Seats' },
        { brand: 'Ergobaby', name: 'Omni 360 Carrier', subcategory: 'Baby Carriers' },
        { brand: 'Ergobaby', name: 'Embrace Carrier', subcategory: 'Baby Carriers' },
        { brand: 'Hatch', name: 'Rest Sound Machine', subcategory: 'Sleep' },
        { brand: 'Hatch', name: 'Restore Sound Machine', subcategory: 'Sleep' },
        { brand: 'Snoo', name: 'Smart Sleeper Bassinet', subcategory: 'Sleep' },
        { brand: 'Nugget', name: 'Play Couch', subcategory: 'Play' },
        { brand: 'Lovevery', name: 'Play Kits', subcategory: 'Educational Toys' },
        { brand: 'Lovevery', name: 'Play Gym', subcategory: 'Play' },
    ],

    'Pet Items': [
        { brand: 'Ruffwear', name: 'Front Range Harness', subcategory: 'Harnesses' },
        { brand: 'Ruffwear', name: 'Cloud Chaser Jacket', subcategory: 'Apparel' },
        { brand: 'Kong', name: 'Dog Toy', subcategory: 'Toys' },
        { brand: 'Kong', name: 'Dog Crate', subcategory: 'Crates' },
        { brand: 'PetSafe', name: 'Underground Fence', subcategory: 'Fences' },
        { brand: 'PetSafe', name: 'Automatic Feeder', subcategory: 'Feeders' },
        { brand: 'Furbo', name: 'Dog Camera', subcategory: 'Cameras' },
        { brand: 'Litter-Robot', name: 'Self-Cleaning Litter Box', subcategory: 'Litter Boxes' },
        { brand: 'Chewy', name: 'Orthopedic Dog Bed', subcategory: 'Beds' },
        { brand: 'Kurgo', name: 'Dog Harness', subcategory: 'Harnesses' },
    ],

    'Craft Supplies': [
        { brand: 'Cricut', name: 'Maker Machine', subcategory: 'Cutting Machines' },
        { brand: 'Cricut', name: 'Explore Machine', subcategory: 'Cutting Machines' },
        { brand: 'Cricut', name: 'EasyPress Heat Press', subcategory: 'Heat Press' },
        { brand: 'Silhouette', name: 'Cameo Machine', subcategory: 'Cutting Machines' },
        { brand: 'Silhouette', name: 'Portrait Machine', subcategory: 'Cutting Machines' },
        { brand: 'Brother', name: 'Sewing Machine', subcategory: 'Sewing Machines' },
        { brand: 'Brother', name: 'Embroidery Machine', subcategory: 'Embroidery' },
        { brand: 'Singer', name: 'Featherweight Sewing Machine', subcategory: 'Vintage Sewing' },
        { brand: 'Singer', name: 'Heavy Duty Sewing Machine', subcategory: 'Sewing Machines' },
        { brand: "McCall's", name: 'Vintage Sewing Pattern', subcategory: 'Patterns' },
        { brand: 'Simplicity', name: 'Vintage Sewing Pattern', subcategory: 'Patterns' },
        { brand: 'Butterick', name: 'Vintage Sewing Pattern', subcategory: 'Patterns' },
        { brand: 'Vogue', name: 'Vintage Sewing Pattern', subcategory: 'Patterns' },
        { brand: 'Hand-Dyed Yarn', name: 'Luxury Yarn', subcategory: 'Yarn' },
        { brand: 'Liberty Fabric', name: 'Liberty of London Fabric', subcategory: 'Fabric' },
        { brand: 'Rifle Paper Co', name: 'Fabric', subcategory: 'Fabric' },
        { brand: 'Japanese Import Fabric', name: 'Japanese Fabric', subcategory: 'Fabric' },
    ],

    'Outdoor & Garden': [
        { brand: 'Weber', name: 'Gas Grill', subcategory: 'Grills' },
        { brand: 'Traeger', name: 'Pellet Grill', subcategory: 'Grills' },
        { brand: 'Big Green Egg', name: 'Ceramic Grill', subcategory: 'Grills' },
        { brand: 'Solo Stove', name: 'Fire Pit', subcategory: 'Fire Pits' },
        { brand: 'Yeti', name: 'Tundra Cooler', subcategory: 'Coolers' },
        { brand: 'Yeti', name: 'Outdoor Chair', subcategory: 'Chairs' },
        { brand: 'Coleman', name: 'Camping Tent', subcategory: 'Tents' },
        { brand: 'Coleman', name: 'Camp Stove', subcategory: 'Stoves' },
        { brand: 'Coleman', name: 'Camping Lantern', subcategory: 'Lighting' },
        { brand: 'REI', name: 'Camping Tent', subcategory: 'Tents' },
        { brand: 'REI', name: 'Backpack', subcategory: 'Backpacks' },
        { brand: 'REI', name: 'Sleeping Bag', subcategory: 'Sleeping Bags' },
        { brand: 'Osprey', name: 'Hiking Backpack', subcategory: 'Backpacks' },
        { brand: 'Gregory', name: 'Backpack', subcategory: 'Backpacks' },
        { brand: 'Deuter', name: 'Backpack', subcategory: 'Backpacks' },
        { brand: 'Black Diamond', name: 'Climbing Gear', subcategory: 'Climbing' },
        { brand: 'Patagonia', name: 'Black Hole Duffel', subcategory: 'Duffels' },
    ],

    'Collectibles & Memorabilia': [
        { brand: 'Topps', name: 'Sports Card', subcategory: 'Sports Cards' },
        { brand: 'Panini', name: 'Sports Card', subcategory: 'Sports Cards' },
        { brand: 'Upper Deck', name: 'Sports Card Graded PSA', subcategory: 'Graded Cards' },
        { brand: 'BGS Graded', name: 'Sports Card BGS', subcategory: 'Graded Cards' },
        { brand: 'Morgan Dollar', name: 'Morgan Silver Dollar', subcategory: 'Coins' },
        { brand: 'Peace Dollar', name: 'Peace Silver Dollar', subcategory: 'Coins' },
        { brand: 'American Silver Eagle', name: 'Silver Eagle Coin', subcategory: 'Coins' },
        { brand: 'First Day Cover', name: 'Stamp Collection', subcategory: 'Stamps' },
        { brand: 'Mint Stamp Sheets', name: 'Mint Stamp Sheet', subcategory: 'Stamps' },
        { brand: 'Vintage Advertising Coca-Cola', name: 'Coca-Cola Collectible', subcategory: 'Advertising' },
        { brand: 'Vintage Gas Station', name: 'Gas Station Sign', subcategory: 'Advertising' },
        { brand: 'Disney Pins', name: 'Disney Pin', subcategory: 'Disney' },
        { brand: 'Disney Vinylmation', name: 'Vinylmation Figure', subcategory: 'Disney' },
        { brand: 'Disney Park Souvenirs', name: 'Disney Park Souvenir', subcategory: 'Disney' },
        { brand: 'Precious Moments', name: 'Precious Moments Figurine', subcategory: 'Figurines' },
        { brand: 'Hummel', name: 'Hummel Figurine', subcategory: 'Figurines' },
        { brand: 'Swarovski', name: 'Annual Ornament', subcategory: 'Swarovski' },
        { brand: 'Swarovski', name: 'Crystal Figurine', subcategory: 'Swarovski' },
    ],

    'Automotive Parts': [
        { brand: 'BMW OEM', name: 'OEM Wheels', subcategory: 'Wheels & Rims' },
        { brand: 'Mercedes OEM', name: 'OEM Wheels', subcategory: 'Wheels & Rims' },
        { brand: 'Audi OEM', name: 'OEM Wheels', subcategory: 'Wheels & Rims' },
        { brand: 'Pioneer', name: 'Car Stereo', subcategory: 'Car Audio' },
        { brand: 'Kenwood', name: 'Car Stereo', subcategory: 'Car Audio' },
        { brand: 'Alpine', name: 'Car Stereo', subcategory: 'Car Audio' },
        { brand: 'Thule', name: 'Roof Rack', subcategory: 'Roof Racks' },
        { brand: 'Yakima', name: 'Roof Rack', subcategory: 'Roof Racks' },
        { brand: 'WeatherTech', name: 'Floor Mats', subcategory: 'Floor Mats' },
        { brand: 'LED Headlights', name: 'LED Headlight Kit', subcategory: 'Lighting' },
        { brand: 'Borla', name: 'Performance Exhaust', subcategory: 'Exhaust' },
        { brand: 'Flowmaster', name: 'Performance Exhaust', subcategory: 'Exhaust' },
        { brand: 'Tonneau Cover', name: 'Truck Bed Cover', subcategory: 'Truck Accessories' },
        { brand: 'Truck Accessories', name: 'Truck Running Boards', subcategory: 'Truck Accessories' },
    ],
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function loadProgress() {
    if (existsSync(PROGRESS_FILE)) {
        try {
            return JSON.parse(readFileSync(PROGRESS_FILE, 'utf-8'));
        } catch {
            return {};
        }
    }
    return {};
}

function saveProgress(progress) {
    writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2), 'utf-8');
}

function progressKey(category, brand, name) {
    return `${category}::${brand}::${name}`;
}

// ─── Claude Generation ───────────────────────────────────────────────────────

async function generateVariations(category, item) {
    const text = await callTextAPI({
        model: 'claude-haiku-4-5-20251001',
        maxTokens: 4000,
        timeoutMs: 60000,
        system: 'You are a resale market data expert. Generate realistic product variations with accurate market pricing based on recent sold listings data. Respond ONLY with a valid JSON array.',
        user: `Generate 100 typical resale variations for ${item.brand} ${item.name} (${category}). For each variation include: variant (colorway/style/size), condition (one of: NWT, NWOT, EUC, GUC, Fair), typical_sold_price_usd (realistic resale price as a number), size (if applicable, or null). Return a JSON array of objects. Example: [{"variant":"Black/White Size 10","condition":"EUC","typical_sold_price_usd":85,"size":"10"}]`,
    });

    // Extract JSON array from response
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) throw new Error('No JSON array found in response');

    return JSON.parse(match[0]);
}

// ─── Database Insertion ──────────────────────────────────────────────────────

async function getExistingCount(category, brand, name) {
    const row = await query.get(
        'SELECT COUNT(*) as count FROM product_reference WHERE category = ? AND brand = ? AND model = ?',
        [category, brand, name]
    );
    return parseInt(row?.count || 0, 10);
}

async function insertVariations(category, item, variations) {
    let inserted = 0;
    for (const variation of variations) {
        if (!variation.variant || variation.typical_sold_price_usd == null) continue;

        const price = Number(variation.typical_sold_price_usd);
        if (!isFinite(price) || price <= 0) continue;

        const tags = JSON.stringify(
            [item.brand, item.name, category, variation.condition, variation.size].filter(Boolean)
        );

        await query.run(
            `INSERT INTO product_reference
                (id, brand, model, category, subcategory, title, condition,
                 avg_sold_price, min_sold_price, max_sold_price, tags, source)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT (id) DO NOTHING`,
            [
                uuidv4(),
                item.brand,
                item.name,
                category,
                item.subcategory || null,
                `${item.brand} ${item.name} ${variation.variant}`,
                variation.condition || null,
                price,
                Math.round(price * 0.7),
                Math.round(price * 1.3),
                tags,
                'claude-generated',
            ]
        );
        inserted++;
    }
    return inserted;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function generateReferences() {
    await initializeDatabase();

    const progress = loadProgress();

    const categoryList = Object.entries(CATEGORIES);
    const totalCategories = categoryList.length;
    const totalItemTypes = Object.values(CATEGORIES).reduce((sum, items) => sum + items.length, 0);

    console.log(`Generating references for ${totalItemTypes} item types across ${totalCategories} categories...`);
    console.log(`Progress file: ${PROGRESS_FILE}\n`);

    let totalInserted = 0;
    let totalErrors = 0;
    let totalApiCalls = 0;
    let categoryIndex = 0;

    for (const [category, itemTypes] of categoryList) {
        categoryIndex++;
        console.log(`\n=== [${categoryIndex}/${totalCategories}] ${category} (${itemTypes.length} item types) ===`);

        let itemIndex = 0;
        for (const item of itemTypes) {
            itemIndex++;
            const key = progressKey(category, item.brand, item.name);

            // Skip if already done (resume support)
            if (progress[key] === 'done') {
                console.log(`  ↷ ${item.brand} ${item.name}: already complete`);
                continue;
            }

            // Skip if DB already has >= 50 entries for this item
            const existing = await getExistingCount(category, item.brand, item.name);
            if (existing >= 50) {
                console.log(`  ↷ ${item.brand} ${item.name}: ${existing} already in DB — skipping`);
                progress[key] = 'done';
                saveProgress(progress);
                continue;
            }

            const label = `  [${itemIndex}/${itemTypes.length}] ${item.brand} ${item.name}`;
            try {
                const variations = await generateVariations(category, item);
                totalApiCalls++;

                const inserted = await insertVariations(category, item, variations);
                totalInserted += inserted;

                progress[key] = 'done';
                saveProgress(progress);

                console.log(`  ✓ ${label.trim()}: ${inserted} variations | Total: ${totalInserted}`);
            } catch (err) {
                totalErrors++;

                // Respect rate limit backoff
                if (err.status === 429 || err.message?.includes('rate limit')) {
                    const waitMs = 10000;
                    console.warn(`  ⚠ Rate limited on ${label.trim()}, waiting ${waitMs / 1000}s...`);
                    await sleep(waitMs);
                    // Retry once after backoff
                    try {
                        const variations = await generateVariations(category, item);
                        totalApiCalls++;
                        const inserted = await insertVariations(category, item, variations);
                        totalInserted += inserted;
                        progress[key] = 'done';
                        saveProgress(progress);
                        console.log(`  ✓ ${label.trim()} (retry): ${inserted} variations | Total: ${totalInserted}`);
                        totalErrors--; // un-count the error
                        continue;
                    } catch (retryErr) {
                        console.error(`  ✗ ${label.trim()} (retry failed): ${retryErr.message}`);
                    }
                } else {
                    console.error(`  ✗ ${label.trim()}: ${err.message}`);
                }
            }

            // Small delay between API calls to avoid rate limiting
            await sleep(200);
        }
    }

    // Cost estimate: Haiku input ~$0.0008/1K tokens, output ~$0.004/1K tokens
    // Each call: ~200 input tokens + ~2000 output tokens ≈ $0.008 per call
    const estimatedCost = (totalApiCalls * 0.008).toFixed(2);

    console.log('\n' + '='.repeat(60));
    console.log(`Done!`);
    console.log(`  Inserted:     ${totalInserted.toLocaleString()} references`);
    console.log(`  Errors:       ${totalErrors}`);
    console.log(`  API calls:    ${totalApiCalls}`);
    console.log(`  Est. cost:    ~$${estimatedCost} USD`);
    console.log('='.repeat(60));

    await closeDatabase();
}

generateReferences().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
