/* eslint-disable no-useless-escape */
const { MessageEmbed } = require('discord.js');
const { MsgProduto } = require('../models/vendas');

/**
 * @typedef {Object} Produto
 * @property {Number} _id
 * @property {String} nome
 * @property {String} server_id
 * @property {Number} valor
 * @property {Number} quantidade
 */

/**
 * Função que atualiza o número de itens disponíveis no estoque
 * @param {Produto} itemAtual
 */
const atualizarMsgProduto = async (itemAtual, interaction) => {
    const embed = new MessageEmbed()
        .setColor('#282C34')
        .setDescription(
            `\`\`\`\✅ ${itemAtual.nome}\`\`\`\n`+
        `\n💎 | **Nome:** ${itemAtual.nome}\n💵 | **Preço:** ${itemAtual.valor}\n📦 | **Stock:** ${itemAtual.quantidade}`
        );

    /** @type {MsgProduto}*/
    const msgProduto = await MsgProduto.findOne({ server_id: interaction.guildId, produtoId: itemAtual._id });

    if (!msgProduto) return;

    /** @type {TextChannel} */
    const canal = interaction.guild.channels.cache.get(msgProduto.canal_id);
    if (!canal) return interaction.followUp({ content: `Canal de atualizar estoque de ${itemAtual.nome} não encontrado`, ephemeral: true });

    canal.messages.fetch(msgProduto.msg_id)
        .then(async m => {
            await m.edit({ embeds: [embed] });
            console.log('Mensagem de estoque de produto atualizada com sucesso');
        })
        .catch(() => console.log('Erro ao atualizar mensagem de estoque de produto'));
};

module.exports = { atualizarMsgProduto };
