const {XElement, importUtil} = require('xx-element');
const {template, name} = importUtil(__filename);

const now = new Date();
const msInHour = 1000 * 60 * 60;

const round = n => Math.round(n * 10) / 10;

const listTuples = [
	['#influence-list', 'influences'],
	['#sockets-list', 'sockets'],
	['#defense-list', 'defenseProperties'],
	['#enchant-list', 'enchantMods'],
	['#implicit-list', 'implicitMods'],
	['#fractured-list', 'fracturedMods'],
	['#explicit-list', 'explicitMods'],
	['#crafted-list', 'craftedMods'],
	['#pseudo-list', 'pseudoMods'],
];

customElements.define(name, class extends XElement {
	static get attributeTypes() {
		return {selected: {boolean: true}, hovered: {boolean: true}};
	}

	static get htmlTemplate() {
		return template;
	}

	connectedCallback() {
		this.$('#copy-item-button').addEventListener('click', e => {
			navigator.clipboard.writeText(this.itemData_.text);
			e.stopPropagation();
		});
		this.$('#whisper-button').addEventListener('click', e => {
			navigator.clipboard.writeText(this.itemData_.whisper);
			e.stopPropagation();
		});
		this.addEventListener('click', () => this.emit('select'));
		this.addEventListener('mouseenter', () => {
			if (!this.hovered)
				this.emit('hover', true);
		});
		this.addEventListener('mouseleave', () => this.emit('hover', false));
	}

	set itemData(itemData) {
		// should only be called once to avoid a late-resolved, stale itemData.valueBuildPromise
		// overwriting the correct one
		this.itemData_ = itemData;

		this.$('#name-text').textContent = itemData.name;
		this.$('#type-text').textContent = itemData.type;
		this.$('#item-level-text').textContent = itemData.itemLevel;

		this.$('#corrupted-text').classList.toggle('hidden', !itemData.corrupted);

		listTuples.forEach(([containerQuery, propertyName]) => {
			XElement.clearChildren(this.$(containerQuery));
			itemData[propertyName].forEach(mod => {
				let modDiv = document.createElement('div');
				modDiv.textContent = mod;
				this.$(containerQuery).appendChild(modDiv);
			});
		});

		this.$('#prefixes-text').textContent = itemData.affixes.prefix;
		this.$('#suffixes-text').textContent = itemData.affixes.suffix;
		this.$('#affix-value-text').textContent = itemData.evalValueDetails.affixes;
		this.$('#defense-value-text').textContent = itemData.evalValueDetails.defenses;
		this.$('#weight-value-text').textContent = itemData.evalValueDetails.mods;

		this.$('#value-text').textContent = round(itemData.evalValue);
		let expandedValues = Object.entries(itemData.evalValueDetails)
			.filter(([_, value]) => value);
		this.$('#value-expanded-text').textContent = expandedValues.length > 1 ?
			expandedValues.map(([name, value]) => `${round(value)} ${name}`).join(' + ') : '';
		itemData.valueBuildPromise.then(valueBuild => {
			this.$('#value-build').text = valueBuild.value;
			this.$('#value-build').tooltip = valueBuild.text;
		});
		this.$('#price-text').textContent = round(itemData.price);
		let expandedPriceShifts = Object.entries(itemData.priceDetails.shifts)
			.map(([name, value]) => ` + ${name} (${round(value)} chaos)`);
		this.$('#price-expanded-text').textContent =
			itemData.priceDetails.currency !== 'chaos' || expandedPriceShifts.length ?
				`${itemData.priceDetails.count} ${itemData.priceDetails.currency}${expandedPriceShifts.join(
					'')}` : '';
		this.$('#whisper-button').textContent = itemData.accountText;
		let dateDiff = (now - new Date(itemData.date)) / msInHour;
		this.$('#date-text').textContent =
			dateDiff > 24 ? `${round(dateDiff / 24)} days ago` : `${round(dateDiff)} hours ago`;

		this.selected = itemData.selected;
		this.hovered = itemData.hovered;
	}

	set selected(value) {
		this.classList.toggle('selected', value);
	}

	set hovered(value) {
		this.classList.toggle('hovered', value);
	}

	get searchTexts() {
		return [...this.$$('div')]
			.filter(div => !div.querySelector('div') && !div.classList.contains('hidden'))
			.map(div => div.textContent.trim().replace(/\s+/g, ' '))
			.filter(text => text);
	}
});
