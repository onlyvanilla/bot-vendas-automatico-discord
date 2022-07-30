// eslint-disable-next-line no-unused-vars
const { MessageEmbed, Collection, ButtonInteraction } = require('discord.js');

/**
 * Função que atualiza o status do carrinho
 * @param {{ nome: String, valor: Number }[]} dados
 * @param {ButtonInteraction} interaction
 */
const gerarEmbedCarrinhoDetalhes = (dados, interaction) => {

    const calcularValor = (quantidade, valorUnidade) => (quantidade * (valorUnidade * 100)) / 100;

    const embed = new MessageEmbed()
        .setAuthor({ name: 'Seu carrinho', iconURL: interaction.member.displayAvatarURL({ dynamic: true }) });

    console.log(dados);

    if (!dados || !dados[0]) return embed;

    const cont = {};

    dados.forEach(e => {
        cont[e.nome] = (cont[e.nome] || 0) + 1;
    });

    const dadosCollection = new Collection();
    dados.forEach(i => dadosCollection.set(i.nome, i));

    const total = dadosCollection
        .map(item => calcularValor(cont[item.nome], item.valor))
        .reduce((acc, curr) => acc + curr);



    dadosCollection.forEach(item => embed.addField(item.nome, `**Quantidade:** ${cont[item.nome]}`));

    return embed
        .setDescription(`**Total:** R$ ${total}`);
};

module.exports = { gerarEmbedCarrinhoDetalhes };
