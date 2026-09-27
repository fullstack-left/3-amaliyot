/** Physical + economic properties of each vehicle kind. */
export const VEHICLE_SPECS = {
    car: { length: 1.15, width: 0.58, height: 0.5, emergency: false, coins: 2, nameUz: 'Yengil avtomobil' },
    taxi: { length: 1.15, width: 0.58, height: 0.5, emergency: false, coins: 2, nameUz: 'Taksi' },
    police: { length: 1.2, width: 0.6, height: 0.52, emergency: false, coins: 3, nameUz: 'YPX (signalsiz)' },
    bus: { length: 2.1, width: 0.68, height: 0.95, emergency: false, coins: 4, nameUz: 'Avtobus' },
    truck: { length: 1.8, width: 0.68, height: 0.85, emergency: false, coins: 3, nameUz: 'Yuk mashinasi' },
    ambulance: { length: 1.4, width: 0.64, height: 0.78, emergency: true, coins: 6, nameUz: 'Tez yordam' },
    fire: { length: 1.9, width: 0.7, height: 0.9, emergency: true, coins: 6, nameUz: "O't o'chirish" },
};
export const VEHICLE_KINDS = [
    'car',
    'taxi',
    'police',
    'bus',
    'truck',
    'ambulance',
    'fire',
];
/** Extra coins for the player's own garage car. */
export const HERO_BONUS = 5;
//# sourceMappingURL=vehicles.js.map