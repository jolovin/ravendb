using System;
using System.Collections.Generic;
using System.Linq;

using Raven.Abstractions.Data;
using Raven.Abstractions.Json;
using Raven.Imports.Newtonsoft.Json;
using Raven.Imports.Newtonsoft.Json.Linq;
using Raven.Json.Linq;

namespace Raven.Abstractions.Smuggler
{
	public class DatabaseSmugglerOptions
	{
		public DatabaseSmugglerOptions()
		{
			Filters = new List<FilterSetting>();
			ConfigureDefaultFilters();
			OperateOnTypes = ItemType.Indexes | ItemType.Documents | ItemType.Transformers;
			ShouldExcludeExpired = false;
			Limit = int.MaxValue;
		}
		private void ConfigureDefaultFilters()
		{
			// filter out encryption verification key document to enable import to encrypted db from encrypted db.
			Filters.Add(new FilterSetting
			{
				Path = "@metadata.@id",
				ShouldMatch = false,
				Values = { Constants.InResourceKeyVerificationDocumentName }
			});
		}

		public ItemType OperateOnTypes { get; set; }

		public int BatchSize { get; set; }

		public bool IgnoreErrorsAndContinue { get; set; }

		public int Limit { get; set; }

		public bool ShouldExcludeExpired { get; set; }

		public virtual bool ExcludeExpired(RavenJObject document, DateTime now)
		{
			var metadata = document.Value<RavenJObject>("@metadata");

			const string RavenExpirationDate = "Raven-Expiration-Date";

			// check for expired documents and exclude them if expired
			if (metadata == null)
			{
				return false;
			}
			var property = metadata[RavenExpirationDate];
			if (property == null)
				return false;

			DateTime dateTime;
			try
			{
				dateTime = property.Value<DateTime>();
			}
			catch (FormatException)
			{
				return false;
			}

			return dateTime < now;
		}

		public List<FilterSetting> Filters { get; set; }

		public string TransformScript { get; set; }

		public bool SkipConflicted { get; set; }

		public bool StripReplicationInformation { get; set; }

		public bool ShouldDisableVersioningBundle { get; set; }

		public int MaxStepsForTransformScript { get; set; }

		public virtual bool MatchFilters(RavenJObject document)
		{
			foreach (var filter in Filters)
			{
				bool anyRecords = false;
				bool matchedFilter = false;
				foreach (var tuple in document.SelectTokenWithRavenSyntaxReturningFlatStructure(filter.Path))
				{
					if (tuple == null || tuple.Item1 == null)
						continue;

					anyRecords = true;

					var val = tuple.Item1.Type == JTokenType.String
								  ? tuple.Item1.Value<string>()
								  : tuple.Item1.ToString(Formatting.None);
					matchedFilter |= filter.Values.Any(value => string.Equals(val, value, StringComparison.OrdinalIgnoreCase)) ==
									 filter.ShouldMatch;
				}

				if (filter.ShouldMatch == false && anyRecords == false) // RDBQA-7
					return true;

				if (matchedFilter == false)
					return false;
			}
			return true;
		}
	}
}